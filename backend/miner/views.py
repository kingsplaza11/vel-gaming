import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Max, Count
from .models import MiningSession, MiningStats
from accounts.models import User

CRYPTO_CURRENCIES = {
    'bitcoin': {'name': 'Bitcoin', 'symbol': '₿', 'base_multiplier': 3.0, 'color': '#F7931A'},
    'ethereum': {'name': 'Ethereum', 'symbol': 'Ξ', 'base_multiplier': 2.5, 'color': '#627EEA'},
    'cardano': {'name': 'Cardano', 'symbol': 'ADA', 'base_multiplier': 2.0, 'color': '#0033AD'},
    'solana': {'name': 'Solana', 'symbol': '◎', 'base_multiplier': 4.0, 'color': '#00FFA3'},
    'dogecoin': {'name': 'Dogecoin', 'symbol': 'Ð', 'base_multiplier': 1.5, 'color': '#C2A633'}
}

@api_view(['POST'])
def start_mining(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        crypto_type = request.data.get('crypto_type', 'bitcoin')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if crypto_type not in CRYPTO_CURRENCIES:
        return Response({'error': 'Invalid cryptocurrency'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            crypto = CRYPTO_CURRENCIES[crypto_type]
            
            # Simulate mining process
            blocks_mined = 0
            bonus_multiplier = Decimal('1.0')
            
            # Mine 3-8 blocks
            for block in range(random.randint(3, 8)):
                # Each block has 70% success rate
                if random.random() < 0.7:
                    blocks_mined += 1
                    
                    # Chance for bonus block (10%)
                    if random.random() < 0.1:
                        bonus_multiplier *= Decimal('1.5')
            
            # Calculate earnings
            base_earnings = crypto['base_multiplier'] * blocks_mined / 5.0
            total_multiplier = Decimal(str(base_earnings)) * bonus_multiplier
            win_amount = bet_amount * total_multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            # Create mining session
            session = MiningSession.objects.create(
                user=user,
                bet_amount=bet_amount,
                crypto_type=crypto['name'],
                blocks_mined=blocks_mined,
                bonus_multiplier=bonus_multiplier,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = MiningStats.objects.get_or_create(user=user)
            stats.total_sessions += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            stats.total_blocks_mined += blocks_mined
            
            # Update highest multiplier
            if total_multiplier > stats.highest_multiplier:
                stats.highest_multiplier = total_multiplier
            
            # Update favorite crypto (most mined)
            crypto_counts = MiningSession.objects.filter(user=user).values('crypto_type').annotate(count=Count('crypto_type')).order_by('-count')
            if crypto_counts:
                stats.favorite_crypto = crypto_counts[0]['crypto_type'].lower().replace(' ', '')
            
            stats.save()
            
            return Response({
                'crypto': crypto,
                'blocks_mined': blocks_mined,
                'bonus_multiplier': float(bonus_multiplier),
                'total_multiplier': float(total_multiplier),
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'session_id': session.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_mining_stats(request):
    """
    Get mining statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get or create stats for the user
        stats, created = MiningStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_sessions = stats.total_sessions
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        total_blocks = stats.total_blocks_mined
        highest_multiplier = float(stats.highest_multiplier) if stats.highest_multiplier else 0
        
        # Calculate profit and ROI
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        
        # Calculate average blocks per session
        avg_blocks_per_session = total_blocks / total_sessions if total_sessions > 0 else 0
        
        # Calculate mining efficiency (blocks per bet unit)
        mining_efficiency = total_blocks / total_bet if total_bet > 0 else 0
        
        # Get favorite crypto info
        favorite_crypto = CRYPTO_CURRENCIES.get(stats.favorite_crypto, CRYPTO_CURRENCIES['bitcoin'])
        
        return Response({
            'total_sessions': total_sessions,
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'total_blocks_mined': total_blocks,
            'avg_blocks_per_session': round(avg_blocks_per_session, 2),
            'mining_efficiency': round(mining_efficiency, 2),
            'highest_multiplier': round(highest_multiplier, 2),
            'favorite_crypto': favorite_crypto,
            'miner_rank': calculate_miner_rank(total_sessions, total_blocks)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_mining_history(request):
    """
    Get recent mining history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 mining sessions, most recent first
        sessions = MiningSession.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for session in sessions:
            profit = session.win_amount - session.bet_amount
            
            history.append({
                'id': session.id,
                'crypto_type': session.crypto_type,
                'bet_amount': float(session.bet_amount),
                'blocks_mined': session.blocks_mined,
                'bonus_multiplier': float(session.bonus_multiplier),
                'win_amount': float(session.win_amount),
                'profit': float(profit),
                'created_at': session.created_at.isoformat(),
                'was_profitable': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_crypto_stats(request):
    """
    Get statistics per cryptocurrency for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        crypto_stats = []
        
        for crypto_key, crypto_info in CRYPTO_CURRENCIES.items():
            sessions = MiningSession.objects.filter(user=request.user, crypto_type=crypto_info['name'])
            session_count = sessions.count()
            
            if session_count > 0:
                total_won = sessions.aggregate(Sum('win_amount'))['win_amount__sum'] or Decimal('0')
                total_bet = sessions.aggregate(Sum('bet_amount'))['bet_amount__sum'] or Decimal('0')
                total_blocks = sessions.aggregate(Sum('blocks_mined'))['blocks_mined__sum'] or 0
                avg_multiplier = sessions.aggregate(Sum('win_amount'))['win_amount__sum'] / total_bet if total_bet > 0 else Decimal('0')
                highest_multiplier = sessions.aggregate(Max('win_amount'))['win_amount__max'] / sessions.aggregate(Max('bet_amount'))['bet_amount__max'] if sessions.aggregate(Max('bet_amount'))['bet_amount__max'] else Decimal('0')
                
                total_profit = total_won - total_bet
                roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
                
                crypto_stats.append({
                    'crypto_key': crypto_key,
                    'crypto_name': crypto_info['name'],
                    'crypto_symbol': crypto_info['symbol'],
                    'session_count': session_count,
                    'total_won': float(total_won),
                    'total_bet': float(total_bet),
                    'total_profit': float(total_profit),
                    'roi': round(float(roi), 2),
                    'total_blocks': total_blocks,
                    'avg_multiplier': float(avg_multiplier),
                    'highest_multiplier': float(highest_multiplier),
                    'color': crypto_info['color']
                })
            else:
                crypto_stats.append({
                    'crypto_key': crypto_key,
                    'crypto_name': crypto_info['name'],
                    'crypto_symbol': crypto_info['symbol'],
                    'session_count': 0,
                    'total_won': 0,
                    'total_bet': 0,
                    'total_profit': 0,
                    'roi': 0,
                    'total_blocks': 0,
                    'avg_multiplier': 0,
                    'highest_multiplier': 0,
                    'color': crypto_info['color']
                })
        
        return Response({
            'crypto_stats': crypto_stats
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_mining_leaderboard(request):
    """
    Get mining leaderboard across all users
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get top 10 miners by total blocks mined
        leaderboard = MiningStats.objects.filter(total_blocks_mined__gt=0).order_by('-total_blocks_mined')[:10]
        
        leaderboard_data = []
        for rank, stat in enumerate(leaderboard, 1):
            leaderboard_data.append({
                'rank': rank,
                'username': stat.user.username,
                'total_blocks_mined': stat.total_blocks_mined,
                'total_sessions': stat.total_sessions,
                'total_won': float(stat.total_won),
                'miner_rank': calculate_miner_rank(stat.total_sessions, stat.total_blocks_mined)
            })
        
        # Add current user's position if not in top 10
        user_stats = MiningStats.objects.filter(user=request.user).first()
        if user_stats and user_stats not in leaderboard:
            user_rank = MiningStats.objects.filter(total_blocks_mined__gt=user_stats.total_blocks_mined).count() + 1
            leaderboard_data.append({
                'rank': user_rank,
                'username': request.user.username,
                'total_blocks_mined': user_stats.total_blocks_mined,
                'total_sessions': user_stats.total_sessions,
                'total_won': float(user_stats.total_won),
                'miner_rank': calculate_miner_rank(user_stats.total_sessions, user_stats.total_blocks_mined),
                'is_current_user': True
            })
        
        return Response({
            'leaderboard': leaderboard_data
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_miner_rank(total_sessions, total_blocks):
    """
    Calculate miner rank based on total sessions and blocks mined
    """
    if total_sessions >= 100 and total_blocks >= 500:
        return "Crypto King 👑"
    elif total_sessions >= 50 and total_blocks >= 250:
        return "Master Miner ⛏️"
    elif total_sessions >= 25 and total_blocks >= 100:
        return "Professional Miner 💼"
    elif total_sessions >= 10 and total_blocks >= 30:
        return "Amateur Miner 🧑‍💻"
    else:
        return "Novice Miner 🎓"