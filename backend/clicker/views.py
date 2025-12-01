import time
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Count, Q, Avg
from .models import ClickerGame, ClickerStats
from accounts.models import User

@api_view(['POST'])
def start_clicker(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        target_clicks = int(request.data.get('target_clicks', 30))
        time_limit = int(request.data.get('time_limit', 10))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Create clicker game
            game = ClickerGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                target_clicks=target_clicks,
                time_limit=time_limit
            )
            
            return Response({
                'game_id': game.id,
                'target_clicks': target_clicks,
                'time_limit': time_limit,
                'start_time': time.time(),
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def register_click(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
        current_time = float(request.data.get('current_time'))
        start_time = float(request.data.get('start_time'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = ClickerGame.objects.get(id=game_id, user=user, status='playing')
            
            elapsed_time = current_time - start_time
            
            # Check if time expired
            if elapsed_time > game.time_limit:
                game.status = 'lost'
                game.win_amount = Decimal('0')
                game.save()
                
                # Update stats
                stats, created = ClickerStats.objects.get_or_create(user=user)
                stats.total_games += 1
                stats.save()
                
                return Response({
                    'clicks': game.clicks_achieved,
                    'elapsed_time': elapsed_time,
                    'status': 'lost',
                    'win_amount': 0,
                    'new_balance': float(user.balance)
                })
            
            # Register click
            game.clicks_achieved += 1
            game.save()
            
            # Calculate current multiplier based on performance
            clicks_per_second = game.clicks_achieved / elapsed_time
            required_cps = game.target_clicks / game.time_limit
            performance_ratio = min(clicks_per_second / required_cps, 2.0)  # Cap at 2x
            game.multiplier = Decimal('1') + Decimal(str(performance_ratio)) * Decimal('3')
            game.save()
            
            # Check if target reached
            if game.clicks_achieved >= game.target_clicks:
                game.status = 'won'
                win_amount = game.bet_amount * game.multiplier
                game.win_amount = win_amount
                
                # Add winnings
                user.balance += win_amount
                user.save()
                game.save()
                
                # Update stats
                stats, created = ClickerStats.objects.get_or_create(user=user)
                stats.total_games += 1
                stats.total_won += win_amount
                if clicks_per_second > stats.highest_cps:
                    stats.highest_cps = Decimal(str(clicks_per_second))
                stats.save()
                
                return Response({
                    'clicks': game.clicks_achieved,
                    'elapsed_time': elapsed_time,
                    'cps': clicks_per_second,
                    'multiplier': float(game.multiplier),
                    'status': 'won',
                    'win_amount': float(win_amount),
                    'new_balance': float(user.balance)
                })
            
            return Response({
                'clicks': game.clicks_achieved,
                'elapsed_time': elapsed_time,
                'cps': clicks_per_second,
                'multiplier': float(game.multiplier),
                'status': 'playing',
                'time_remaining': game.time_limit - elapsed_time
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_clicker_stats(request):
    """
    Get clicker game statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get or create stats for the user
        stats, created = ClickerStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics from game history
        games = ClickerGame.objects.filter(user=request.user)
        total_games = games.count()
        won_games = games.filter(status='won').count()
        win_rate = won_games / total_games if total_games > 0 else 0
        
        return Response({
            'total_games': stats.total_games,
            'total_won': float(stats.total_won),
            'highest_cps': float(stats.highest_cps),
            'win_rate': win_rate,
            'clicker_level': calculate_clicker_level(stats.total_games, stats.highest_cps)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_clicker_history(request):
    """
    Get recent clicker game history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 clicker games, most recent first
        games = ClickerGame.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for game in games:
            history.append({
                'id': game.id,
                'bet_amount': float(game.bet_amount),
                'target_clicks': game.target_clicks,
                'time_limit': game.time_limit,
                'clicks_achieved': game.clicks_achieved,
                'multiplier': float(game.multiplier),
                'win_amount': float(game.win_amount),
                'status': game.status,
                'created_at': game.created_at.isoformat()
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_clicker_level(total_games, highest_cps):
    """
    Calculate clicker level based on total games and highest CPS
    """
    if total_games >= 50 and highest_cps >= 10:
        return "Click Master 🎯"
    elif total_games >= 25 and highest_cps >= 7:
        return "Speed Demon ⚡"
    elif total_games >= 10 and highest_cps >= 5:
        return "Rapid Clicker 🖱️"
    elif total_games >= 5:
        return "Amateur Clicker 👆"
    else:
        return "Novice Clicker 🐌"