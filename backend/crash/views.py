from decimal import Decimal
from rest_framework import generics, permissions, views, response, status
from .models import GameRound
from .serializers import GameRoundSerializer
from .provably_fair import verify_round
import json
from decimal import Decimal
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum, Q
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import GameRound, CrashBet, RiskSettings
from wallets.models import Wallet


class RecentRoundsView(generics.ListAPIView):
    serializer_class = GameRoundSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        # Remove demo mode filtering
        return GameRound.objects.all().order_by("-id")[:50]


class VerifyRoundView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        server_seed = request.data.get("server_seed")
        client_seed = request.data.get("client_seed")
        nonce = int(request.data.get("nonce"))
        crash_point = Decimal(str(request.data.get("crash_point")))

        ok = verify_round(server_seed, client_seed, nonce, crash_point)
        return response.Response({"valid": ok})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def place_bet(request):
    """
    REST API endpoint for placing bets in Crash game
    """
    user = request.user
    
    try:
        # Get request data
        data = request.data
        amount = Decimal(str(data.get('amount', '0')))
        auto_cashout = data.get('auto_cashout')
        auto_cashout = Decimal(str(auto_cashout)) if auto_cashout else None
        
        # Validate amount
        if amount <= 0:
            return Response(
                {'error': 'Invalid bet amount'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get risk settings
        risk = RiskSettings.get()
        
        # Check minimum bet
        min_bet = getattr(risk, 'min_bet_per_player', Decimal('100'))
        if amount < min_bet:
            return Response(
                {'error': f'Minimum bet is ₦{min_bet}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check maximum bet
        max_bet = getattr(risk, 'max_bet_per_player', Decimal('1000'))
        if amount > max_bet:
            return Response(
                {'error': f'Maximum bet is ₦{max_bet}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate auto cashout if provided
        if auto_cashout:
            min_auto = getattr(risk, 'min_auto_cashout', Decimal('1.1'))
            max_auto = getattr(risk, 'max_auto_cashout', Decimal('100.0'))
            
            if auto_cashout < min_auto:
                return Response(
                    {'error': f'Auto cashout must be at least {min_auto}x'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            if auto_cashout > max_auto:
                return Response(
                    {'error': f'Auto cashout cannot exceed {max_auto}x'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        with transaction.atomic():
            # Get current round (most recent pending or running round)
            round_obj = GameRound.objects.filter(
                status__in=['PENDING', 'RUNNING']
            ).order_by('-created_at').first()
            
            if not round_obj:
                # Create new round if none exists
                round_obj = GameRound.objects.create(
                    status='PENDING',
                    crash_point=Decimal('0.00'),  # Will be set by engine
                    server_seed='pending',
                    server_seed_hash='pending',
                    client_seed='pending',
                    nonce=0,
                )
            
            # Check if betting is allowed
            if round_obj.status != 'PENDING':
                return Response(
                    {'error': 'Betting is closed for this round'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get wallet with lock
            wallet = Wallet.objects.select_for_update().get(user=user)
            
            # Check available funds: first balance, then spot_balance
            available_balance = wallet.balance
            available_spot = wallet.spot_balance
            
            # Calculate total available
            total_available = available_balance + available_spot
            
            if amount > total_available:
                return Response(
                    {'error': 'Insufficient funds'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calculate how much to take from each balance
            amount_from_balance = min(amount, available_balance)
            amount_from_spot = amount - amount_from_balance
            
            # Check player exposure per round
            max_player_per_round = getattr(risk, 'max_bet_per_player_per_round', Decimal('5000'))
            player_total_bet = CrashBet.objects.filter(
                user=user,
                round=round_obj,
                status='ACTIVE'
            ).aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
            
            if player_total_bet + amount > max_player_per_round:
                return Response(
                    {'error': f'Maximum bet per round is ₦{max_player_per_round}'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check round exposure
            max_exposure = getattr(risk, 'max_exposure_per_round', Decimal('10000'))
            round_total_bet = CrashBet.objects.filter(
                round=round_obj,
                status='ACTIVE'
            ).aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
            
            if round_total_bet + amount > max_exposure:
                return Response(
                    {'error': 'Round exposure limit reached'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check cooldown (prevent spam)
            bet_cooldown = getattr(risk, 'bet_cooldown_seconds', 1)
            last_bet = CrashBet.objects.filter(
                user=user,
                created_at__gte=timezone.now() - timezone.timedelta(seconds=bet_cooldown)
            ).first()
            
            if last_bet:
                return Response(
                    {'error': f'Please wait {bet_cooldown} second(s) before placing another bet'}, 
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )
            
            # Check bets per minute limit
            max_bets_per_min = getattr(risk, 'max_bets_per_minute', 30)
            recent_bets_count = CrashBet.objects.filter(
                user=user,
                created_at__gte=timezone.now() - timezone.timedelta(minutes=1)
            ).count()
            
            if recent_bets_count >= max_bets_per_min:
                return Response(
                    {'error': f'Too many bets. Maximum {max_bets_per_min} per minute.'}, 
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )
            
            # Deduct from balances
            if amount_from_balance > 0:
                wallet.balance -= amount_from_balance
            
            if amount_from_spot > 0:
                wallet.spot_balance -= amount_from_spot
            
            # Save wallet changes
            wallet.save(update_fields=['balance', 'spot_balance'])
            
            # Create bet record
            bet = CrashBet.objects.create(
                user=user,
                round=round_obj,
                bet_amount=amount,
                auto_cashout=auto_cashout,
                status='ACTIVE',
                ip_address=request.META.get('REMOTE_ADDR'),
                device_fingerprint=request.META.get('HTTP_USER_AGENT', '')[:200],
            )
        
        # Get updated wallet
        wallet.refresh_from_db()
        
        return Response({
            'success': True,
            'bet_id': bet.id,
            'round_id': round_obj.id,
            'balance': float(wallet.balance),
            'spot_balance': float(wallet.spot_balance),
            'total_balance': float(wallet.balance + wallet.spot_balance),
            'message': 'Bet placed successfully'
        })
        
    except Wallet.DoesNotExist:
        return Response(
            {'error': 'Wallet not found'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cash_out(request):
    """
    REST API endpoint for cashing out in Crash game
    """
    user = request.user
    
    try:
        # Get request data
        data = request.data
        bet_id = data.get('bet_id')
        multiplier = Decimal(str(data.get('multiplier', '1.0')))
        
        # Validate multiplier
        if multiplier <= Decimal('1.0'):
            return Response(
                {'error': 'Invalid multiplier'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Get bet with lock
            bet = CrashBet.objects.select_for_update().select_related(
                'round'
            ).get(
                id=bet_id,
                user=user
            )
            
            # Check bet status
            if bet.status != 'ACTIVE':
                return Response(
                    {'error': 'Bet is not active'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get round
            round_obj = bet.round
            
            # Check round status
            if round_obj.status != 'RUNNING':
                return Response(
                    {'error': 'Round is not running'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if round has crashed
            if round_obj.crash_point and multiplier > round_obj.crash_point:
                return Response(
                    {'error': 'Too late to cash out - round has crashed'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Calculate payout
            payout = (bet.bet_amount * multiplier).quantize(Decimal('0.01'))
            
            # Check maximum win
            risk = RiskSettings.get()
            max_win = getattr(risk, 'max_win_per_bet', Decimal('50000'))
            if payout > max_win:
                payout = max_win
            
            # Get wallet
            wallet = Wallet.objects.select_for_update().get(user=user)
            
            # Credit winnings to main balance
            wallet.spot_balance += payout
            wallet.save(update_fields=['balance'])
            
            # Update bet
            bet.cashout_multiplier = multiplier
            bet.win_amount = payout
            bet.status = 'CASHED_OUT'
            bet.cashed_out_at = timezone.now()
            bet.save()
        
        # Get updated wallet
        wallet.refresh_from_db()
        
        return Response({
            'success': True,
            'bet_id': bet.id,
            'multiplier': float(multiplier),
            'payout': float(payout),
            'balance': float(wallet.balance),
            'spot_balance': float(wallet.spot_balance),
            'total_balance': float(wallet.balance + wallet.spot_balance),
            'message': 'Successfully cashed out'
        })
        
    except CrashBet.DoesNotExist:
        return Response(
            {'error': 'Bet not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Wallet.DoesNotExist:
        return Response(
            {'error': 'Wallet not found'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_stats(request):
    """
    Get crash game statistics for the user
    """
    user = request.user
    
    try:
        # Get user stats
        user_bets = CrashBet.objects.filter(user=user)
        
        total_bets = user_bets.count()
        total_bet_amount = user_bets.aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
        
        # Total won from cashed out bets
        total_won = user_bets.filter(
            status='CASHED_OUT'
        ).aggregate(total=Sum('win_amount'))['total'] or Decimal('0')
        
        # Total lost from LOST bets
        total_lost = user_bets.filter(
            status='LOST'
        ).aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
        
        # Calculate profit/loss
        profit_loss = total_won - total_bet_amount
        
        # Calculate win rate (based on cashed out vs lost)
        won_bets = user_bets.filter(status='CASHED_OUT').count()
        lost_bets = user_bets.filter(status='LOST').count()
        total_settled = won_bets + lost_bets
        win_rate = (won_bets / total_settled * 100) if total_settled > 0 else 0
        
        # Get active bets
        active_bets = user_bets.filter(status='ACTIVE').values(
            'id', 'bet_amount', 'auto_cashout', 'created_at'
        )
        
        # Get recent bets (last 10)
        recent_bets = user_bets.order_by('-created_at')[:10].values(
            'id', 'bet_amount', 'cashout_multiplier', 'win_amount',
            'status', 'created_at'
        )
        
        # Get best win
        best_win = user_bets.filter(
            status='CASHED_OUT'
        ).order_by('-win_amount').first()
        
        # Get current round info
        current_round = GameRound.objects.filter(
            status__in=['PENDING', 'RUNNING']
        ).order_by('-created_at').first()
        
        round_info = None
        if current_round:
            round_info = {
                'id': current_round.id,
                'status': current_round.status,
                'created_at': current_round.created_at,
                'crash_point': float(current_round.crash_point) if current_round.crash_point else None,
            }
        
        # Get wallet info
        wallet = Wallet.objects.get(user=user)
        
        # Get risk settings with defaults
        risk = RiskSettings.get()
        risk_data = {
            'min_bet': float(getattr(risk, 'min_bet_per_player', Decimal('100'))),
            'max_bet': float(getattr(risk, 'max_bet_per_player', Decimal('1000'))),
            'max_win_per_bet': float(getattr(risk, 'max_win_per_bet', Decimal('50000'))),
            'max_exposure_per_round': float(getattr(risk, 'max_exposure_per_round', Decimal('10000'))),
            'house_edge': float(getattr(risk, 'house_edge_percent', Decimal('1.0'))),
            'max_multiplier': float(getattr(risk, 'max_multiplier_cap', Decimal('500.0'))),
        }
        
        return Response({
            'wallet': {
                'balance': float(wallet.balance),
                'spot_balance': float(wallet.spot_balance),
                'total_balance': float(wallet.balance + wallet.spot_balance),
            },
            'user_stats': {
                'total_bets': total_bets,
                'total_bet_amount': float(total_bet_amount),
                'total_won': float(total_won),
                'total_lost': float(total_lost),
                'profit_loss': float(profit_loss),
                'win_rate': float(win_rate),
                'won_bets': won_bets,
                'lost_bets': lost_bets,
            },
            'best_win': {
                'multiplier': float(best_win.cashout_multiplier) if best_win else 0,
                'amount': float(best_win.win_amount) if best_win else 0,
                'bet_amount': float(best_win.bet_amount) if best_win else 0,
            } if best_win else None,
            'active_bets': list(active_bets),
            'recent_bets': list(recent_bets),
            'current_round': round_info,
            'risk_settings': risk_data
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_history(request):
    """
    Get crash game history (public rounds)
    """
    limit = min(int(request.GET.get('limit', 50)), 100)
    
    try:
        # Get completed rounds (CRASHED status in your model)
        rounds = GameRound.objects.filter(
            status='CRASHED'
        ).order_by('-created_at')[:limit].values(
            'id', 'crash_point', 'created_at'
        )
        
        # For each round, get bet statistics
        from django.db.models import Count
        history = []
        for round_obj in rounds:
            # Get bet stats for this round
            bet_stats = CrashBet.objects.filter(
                round_id=round_obj['id']
            ).aggregate(
                total_bets=Sum('bet_amount'),
                total_players=Count('user', distinct=True),
                cashed_out=Count('id', filter=Q(status='CASHED_OUT')),
            )
            
            history.append({
                'round_id': round_obj['id'],
                'crash_point': float(round_obj['crash_point']) if round_obj['crash_point'] else None,
                'total_bet_amount': float(bet_stats['total_bets'] or 0),
                'total_players': bet_stats['total_players'] or 0,
                'cashed_out_players': bet_stats['cashed_out'] or 0,
                'created_at': round_obj['created_at'],
            })
        
        return Response({
            'history': history,
            'count': len(history)
        })
        
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_bet(request):
    """
    Cancel an active bet (if allowed)
    """
    user = request.user
    bet_id = request.data.get('bet_id')
    
    try:
        with transaction.atomic():
            # Get bet with lock
            bet = CrashBet.objects.select_for_update().select_related(
                'round'
            ).get(
                id=bet_id,
                user=user
            )
            
            # Check if cancellation is allowed
            if bet.status != 'ACTIVE':
                return Response(
                    {'error': 'Bet is not active'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            round_obj = bet.round
            
            if round_obj.status != 'PENDING':
                return Response(
                    {'error': 'Cannot cancel bet - round has started'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get wallet with lock
            wallet = Wallet.objects.select_for_update().get(user=user)
            
            # Refund bet amount to main balance (always refund to main balance)
            wallet.balance += bet.bet_amount
            wallet.save(update_fields=['balance'])
            
            # Update bet status
            bet.status = 'CANCELLED'
            bet.save()
        
        # Get updated wallet
        wallet.refresh_from_db()
        
        return Response({
            'success': True,
            'message': 'Bet cancelled successfully',
            'refunded_amount': float(bet.bet_amount),
            'balance': float(wallet.balance),
            'spot_balance': float(wallet.spot_balance),
            'total_balance': float(wallet.balance + wallet.spot_balance)
        })
        
    except CrashBet.DoesNotExist:
        return Response(
            {'error': 'Bet not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Wallet.DoesNotExist:
        return Response(
            {'error': 'Wallet not found'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )