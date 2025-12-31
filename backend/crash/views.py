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
from rest_framework import status

from .models import GameRound, CrashBet, RiskSettings
from wallets.models import Wallet

class RecentRoundsView(generics.ListAPIView):
    serializer_class = GameRoundSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        is_demo = self.request.query_params.get("is_demo") == "true"
        return GameRound.objects.filter(is_demo=is_demo).order_by("-id")[:50]


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
        mode = data.get('mode', 'real')
        
        # Validate mode
        if mode not in ['real', 'demo']:
            return Response(
                {'error': 'Invalid game mode'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_demo = mode == 'demo'
        
        # Get risk settings
        risk = RiskSettings.get()
        
        # Validate amount
        if amount <= 0:
            return Response(
                {'error': 'Invalid bet amount'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if amount < risk.min_bet_per_player:
            return Response(
                {'error': f'Minimum bet is ₦{risk.min_bet_per_player}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if amount > risk.max_bet_per_player:
            return Response(
                {'error': f'Maximum bet is ₦{risk.max_bet_per_player}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Get current round (most recent pending or running round)
            round_obj = GameRound.objects.filter(
                is_demo=is_demo,
                status__in=['PENDING', 'RUNNING']
            ).order_by('-created_at').first()
            
            if not round_obj:
                # Create new round if none exists
                round_obj = GameRound.objects.create(
                    is_demo=is_demo,
                    status='PENDING'
                )
            
            # Check if betting is allowed
            if round_obj.status != 'PENDING':
                return Response(
                    {'error': 'Betting is closed for this round'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check wallet balance
            wallet = Wallet.objects.select_for_update().get(
                user=user,
                is_demo=is_demo
            )
            
            if wallet.balance < amount:
                return Response(
                    {'error': 'Insufficient balance'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check player exposure
            player_total_bet = CrashBet.objects.filter(
                user=user,
                round=round_obj,
                status='ACTIVE'
            ).aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
            
            if player_total_bet + amount > risk.max_bet_per_player_per_round:
                return Response(
                    {'error': f'Maximum bet per round is ₦{risk.max_bet_per_player_per_round}'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check round exposure
            round_total_bet = CrashBet.objects.filter(
                round=round_obj,
                status='ACTIVE'
            ).aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
            
            if round_total_bet + amount > risk.max_exposure_per_round:
                return Response(
                    {'error': 'Round exposure limit reached'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check cooldown (prevent spam)
            last_bet = CrashBet.objects.filter(
                user=user,
                is_demo=is_demo,
                created_at__gte=timezone.now() - timezone.timedelta(seconds=1)
            ).first()
            
            if last_bet:
                return Response(
                    {'error': 'Please wait before placing another bet'}, 
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )
            
            # Place bet atomic operation
            ref = f'CRASH-BET-{round_obj.id}-{user.id}-{int(timezone.now().timestamp())}'
            
            try:
                # Deduct from wallet
                wallet.balance -= amount
                wallet.save(update_fields=['balance'])
                
                # Create bet record
                bet = CrashBet.objects.create(
                    user=user,
                    round=round_obj,
                    bet_amount=amount,
                    auto_cashout=auto_cashout,
                    status='ACTIVE',
                    is_demo=is_demo,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    device_fingerprint=request.META.get('HTTP_USER_AGENT', '')[:200],
                )
                
                # Update round bet count
                round_obj.total_bets += 1
                round_obj.total_bet_amount += amount
                round_obj.save(update_fields=['total_bets', 'total_bet_amount'])
                
            except Exception as e:
                return Response(
                    {'error': f'Bet placement failed: {str(e)}'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        # Get updated balance
        wallet.refresh_from_db()
        
        return Response({
            'success': True,
            'bet_id': bet.id,
            'round_id': round_obj.id,
            'balance': float(wallet.balance),
            'message': 'Bet placed successfully'
        })
        
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
        mode = data.get('mode', 'real')
        
        # Validate mode
        if mode not in ['real', 'demo']:
            return Response(
                {'error': 'Invalid game mode'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_demo = mode == 'demo'
        
        # Validate multiplier
        if multiplier <= Decimal('1.0'):
            return Response(
                {'error': 'Invalid multiplier'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            # Get bet with lock
            bet = CrashBet.objects.select_for_update().select_related(
                'round', 'user'
            ).get(
                id=bet_id,
                user=user,
                is_demo=is_demo
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
            if payout > risk.max_win_per_bet:
                payout = risk.max_win_per_bet
            
            # Get wallet
            wallet = Wallet.objects.select_for_update().get(
                user=user,
                is_demo=is_demo
            )
            
            # Credit winnings
            wallet.balance += payout
            wallet.save(update_fields=['balance'])
            
            # Update bet
            bet.cashout_multiplier = multiplier
            bet.cashout_amount = payout
            bet.status = 'CASHED_OUT'
            bet.cashed_out_at = timezone.now()
            bet.save()
            
            # Update round stats
            round_obj.total_cashed_out += 1
            round_obj.total_payout_amount += payout
            round_obj.save(update_fields=['total_cashed_out', 'total_payout_amount'])
        
        # Get updated balance
        wallet.refresh_from_db()
        
        return Response({
            'success': True,
            'bet_id': bet.id,
            'multiplier': float(multiplier),
            'payout': float(payout),
            'balance': float(wallet.balance),
            'message': 'Successfully cashed out'
        })
        
    except CrashBet.DoesNotExist:
        return Response(
            {'error': 'Bet not found'}, 
            status=status.HTTP_404_NOT_FOUND
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
    mode = request.GET.get('mode', 'real')
    is_demo = mode == 'demo'
    
    try:
        # Get user stats
        user_bets = CrashBet.objects.filter(
            user=user,
            is_demo=is_demo
        )
        
        total_bets = user_bets.count()
        total_bet_amount = user_bets.aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
        total_won = user_bets.filter(
            status='CASHED_OUT'
        ).aggregate(total=Sum('cashout_amount'))['total'] or Decimal('0')
        total_lost = user_bets.filter(
            status='CRASHED'
        ).aggregate(total=Sum('bet_amount'))['total'] or Decimal('0')
        
        # Get active bets
        active_bets = user_bets.filter(status='ACTIVE').values(
            'id', 'bet_amount', 'auto_cashout', 'created_at'
        )
        
        # Get recent bets (last 10)
        recent_bets = user_bets.order_by('-created_at')[:10].values(
            'id', 'bet_amount', 'cashout_multiplier', 'cashout_amount',
            'status', 'created_at'
        )
        
        # Get best win
        best_win = user_bets.filter(
            status='CASHED_OUT'
        ).order_by('-cashout_amount').first()
        
        # Get current round info
        current_round = GameRound.objects.filter(
            is_demo=is_demo,
            status__in=['PENDING', 'RUNNING']
        ).order_by('-created_at').first()
        
        round_info = None
        if current_round:
            round_info = {
                'id': current_round.id,
                'status': current_round.status,
                'created_at': current_round.created_at,
                'total_bets': current_round.total_bets,
                'total_bet_amount': float(current_round.total_bet_amount),
            }
        
        return Response({
            'user_stats': {
                'total_bets': total_bets,
                'total_bet_amount': float(total_bet_amount),
                'total_won': float(total_won),
                'total_lost': float(total_lost),
                'profit_loss': float(total_won - total_bet_amount),
                'win_rate': float((total_won / total_bet_amount * 100) if total_bet_amount > 0 else 0),
            },
            'best_win': {
                'multiplier': float(best_win.cashout_multiplier) if best_win else 0,
                'amount': float(best_win.cashout_amount) if best_win else 0,
                'bet_amount': float(best_win.bet_amount) if best_win else 0,
            } if best_win else None,
            'active_bets': list(active_bets),
            'recent_bets': list(recent_bets),
            'current_round': round_info,
            'risk_settings': {
                'min_bet': float(RiskSettings.get().min_bet_per_player),
                'max_bet': float(RiskSettings.get().max_bet_per_player),
                'max_win_per_bet': float(RiskSettings.get().max_win_per_bet),
                'max_exposure_per_round': float(RiskSettings.get().max_exposure_per_round),
            }
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
    mode = request.GET.get('mode', 'real')
    is_demo = mode == 'demo'
    limit = min(int(request.GET.get('limit', 50)), 100)
    
    try:
        # Get completed rounds
        rounds = GameRound.objects.filter(
            is_demo=is_demo,
            status='COMPLETED'
        ).order_by('-created_at')[:limit].values(
            'id', 'crash_point', 'total_bets', 'total_bet_amount',
            'total_payout_amount', 'created_at'
        )
        
        # Format data
        history = []
        for round_obj in rounds:
            history.append({
                'round_id': round_obj['id'],
                'crash_point': float(round_obj['crash_point']) if round_obj['crash_point'] else None,
                'total_bets': round_obj['total_bets'],
                'total_bet_amount': float(round_obj['total_bet_amount']),
                'total_payout_amount': float(round_obj['total_payout_amount']),
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
    mode = request.data.get('mode', 'real')
    is_demo = mode == 'demo'
    
    try:
        with transaction.atomic():
            # Get bet with lock
            bet = CrashBet.objects.select_for_update().select_related(
                'round'
            ).get(
                id=bet_id,
                user=user,
                is_demo=is_demo
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
            
            # Refund bet amount
            wallet = Wallet.objects.select_for_update().get(
                user=user,
                is_demo=is_demo
            )
            
            wallet.balance += bet.bet_amount
            wallet.save(update_fields=['balance'])
            
            # Update bet status
            bet.status = 'CANCELLED'
            bet.save()
            
            # Update round stats
            round_obj.total_bets = max(0, round_obj.total_bets - 1)
            round_obj.total_bet_amount = max(Decimal('0'), round_obj.total_bet_amount - bet.bet_amount)
            round_obj.save(update_fields=['total_bets', 'total_bet_amount'])
        
        return Response({
            'success': True,
            'message': 'Bet cancelled successfully',
            'refunded_amount': float(bet.bet_amount),
            'balance': float(wallet.balance)
        })
        
    except CrashBet.DoesNotExist:
        return Response(
            {'error': 'Bet not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        return Response(
            {'error': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )