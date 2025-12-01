import random
import math
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.core.cache import cache
from .models import CrashGame, CrashStats
from accounts.models import User

def generate_crash_point():
    """
    Improved crash point generation using provably fair algorithm
    Returns multiplier between 1.00 and 1000.00
    """
    house_edge = 0.01  # 1% house edge
    e = 2**52
    rand = random.SystemRandom().randrange
    h = rand(e)
    crash_point = (e * (1 - house_edge)) / (e - h)
    crash_point = Decimal(max(1.00, min(1000.00, crash_point)))
    return crash_point

@api_view(['POST'])
def place_bet(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
    except:
        return Response({'error': 'Invalid bet amount'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)

            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)

            # Deduct balance
            user.balance -= bet_amount
            user.save()

            crash_point = generate_crash_point()

            game = CrashGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                crash_point=crash_point,
                status='pending'
            )

            return Response({
                'message': 'Bet placed',
                'game_id': game.id,
                'crash_point': float(crash_point),
                'countdown': 3,  # Frontend countdown before start
                'balance': float(user.balance)
            })

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def cash_out(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    game_id = request.data.get('game_id')
    try:
        cash_out_point = Decimal(str(request.data.get('cash_out_point', 1.0)))
        if cash_out_point < 1.00:
            return Response({'error': 'Invalid cash out point'}, status=status.HTTP_400_BAD_REQUEST)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid cash out point'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            game = CrashGame.objects.select_related('user').get(id=game_id, user=request.user, status='pending')
            
            if cash_out_point >= game.crash_point:
                return Response({'error': 'Game already crashed'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Calculate win
            win_amount = game.bet_amount * cash_out_point
            game.win_amount = win_amount
            game.cash_out_point = cash_out_point
            game.status = 'cashed_out'
            game.save()
            
            # Update user balance
            user = User.objects.select_for_update().get(id=request.user.id)
            user.balance += win_amount
            user.save()
            
            # Update stats
            stats, created = CrashStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.total_bet += game.bet_amount
            stats.total_won += win_amount
            if cash_out_point > stats.highest_multiplier:
                stats.highest_multiplier = cash_out_point
            stats.save()
            
            # Remove from active games
            active_games = cache.get('active_crash_games', [])
            active_games = [g for g in active_games if g['game_id'] != str(game_id)]
            cache.set('active_crash_games', active_games, 300)
            
            return Response({
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'cash_out_point': float(cash_out_point)
            })
            
    except CrashGame.DoesNotExist:
        return Response({'error': 'Game not found'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def game_crashed(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    game_id = request.data.get('game_id')

    try:
        game = CrashGame.objects.get(id=game_id, user=request.user, status='pending')
        game.status = 'crashed'
        game.save()

        stats, _ = CrashStats.objects.get_or_create(user=request.user)
        stats.total_games += 1
        stats.total_bet += game.bet_amount
        stats.save()

        return Response({'message': 'crashed', 'crash_point': float(game.crash_point)})
    except:
        return Response({'error': 'Game not found'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def get_crash_stats(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    stats, created = CrashStats.objects.get_or_create(user=request.user)
    return Response({
        'total_games': stats.total_games,
        'total_won': float(stats.total_won),
        'total_bet': float(stats.total_bet),
        'highest_multiplier': float(stats.highest_multiplier),
        'profit_loss': float(stats.total_won - stats.total_bet)
    })

@api_view(['GET'])
def get_crash_history(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    games = CrashGame.objects.filter(user=request.user).order_by('-created_at')[:10]
    history = []
    for game in games:
        history.append({
            'bet_amount': float(game.bet_amount),
            'crash_point': float(game.crash_point) if game.crash_point else None,
            'cash_out_point': float(game.cash_out_point) if game.cash_out_point else None,
            'win_amount': float(game.win_amount),
            'status': game.status,
            'created_at': game.created_at.strftime("%Y-%m-%d %H:%M:%S")  # FIX HERE
        })
    return Response(history)


@api_view(['GET'])
def get_global_history(request):
    """Get recent global crash history for all users"""
    games = CrashGame.objects.filter(status__in=['crashed', 'cashed_out']).order_by('-created_at')[:50]
    history = []
    for game in games:
        history.append({
            'username': game.user.username[:3] + '***',  # Partial username for privacy
            'multiplier': float(game.cash_out_point if game.status == 'cashed_out' else game.crash_point),
            'bet_amount': float(game.bet_amount),
            'win_amount': float(game.win_amount),
            'status': game.status,
            'created_at': game.created_at.isoformat()
        })
    return Response(history)