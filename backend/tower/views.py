import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import TowerGame, TowerStats
from accounts.models import User

@api_view(['POST'])
def start_tower(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        target_height = int(request.data.get('target_height', 10))
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
            
            # Create tower game
            game = TowerGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                target_height=target_height
            )
            
            return Response({
                'game_id': game.id,
                'target_height': target_height,
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def build_level(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = TowerGame.objects.get(id=game_id, user=user, status='building')
            
            # Difficulty increases with height
            crash_chance = min(0.1 + (game.current_height * 0.05), 0.8)
            
            if random.random() < crash_chance:
                # Tower crashes
                game.status = 'crashed'
                game.win_amount = Decimal('0')
                game.save()
                
                # Update stats
                stats, created = TowerStats.objects.get_or_create(user=user)
                stats.total_games += 1
                if game.current_height > stats.highest_tower:
                    stats.highest_tower = game.current_height
                stats.save()
                
                return Response({
                    'success': False,
                    'current_height': game.current_height,
                    'status': 'crashed',
                    'win_amount': 0,
                    'new_balance': float(user.balance)
                })
            
            # Build successful
            game.current_height += 1
            game.multiplier = Decimal('1') + (Decimal(str(game.current_height)) * Decimal('0.2'))
            game.save()
            
            # Check if target reached
            if game.current_height >= game.target_height:
                game.status = 'completed'
                win_amount = game.bet_amount * game.multiplier
                game.win_amount = win_amount
                
                # Add winnings
                user.balance += win_amount
                user.save()
                game.save()
                
                # Update stats
                stats, created = TowerStats.objects.get_or_create(user=user)
                stats.total_games += 1
                stats.total_won += win_amount
                if game.current_height > stats.highest_tower:
                    stats.highest_tower = game.current_height
                stats.save()
                
                return Response({
                    'success': True,
                    'current_height': game.current_height,
                    'multiplier': float(game.multiplier),
                    'status': 'completed',
                    'win_amount': float(win_amount),
                    'new_balance': float(user.balance)
                })
            
            return Response({
                'success': True,
                'current_height': game.current_height,
                'multiplier': float(game.multiplier),
                'status': 'building',
                'crash_chance': round(crash_chance * 100, 1)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def cash_out_tower(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = TowerGame.objects.get(id=game_id, user=user, status='building')
            
            # Calculate win amount
            win_amount = game.bet_amount * game.multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            game.status = 'cashed_out'
            game.win_amount = win_amount
            game.save()
            
            # Update stats
            stats, created = TowerStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_won += win_amount
            if game.current_height > stats.highest_tower:
                stats.highest_tower = game.current_height
            stats.save()
            
            return Response({
                'win_amount': float(win_amount),
                'multiplier': float(game.multiplier),
                'height_reached': game.current_height,
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_tower_stats(request):
    """
    Get tower building statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        stats, created = TowerStats.objects.get_or_create(user=request.user)
        
        return Response({
            'total_games': stats.total_games,
            'total_won': float(stats.total_won),
            'highest_tower': stats.highest_tower,
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_tower_history(request):
    """
    Get recent tower game history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 tower games, most recent first
        games = TowerGame.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for game in games:
            history.append({
                'id': game.id,
                'bet_amount': float(game.bet_amount),
                'current_height': game.current_height,
                'target_height': game.target_height,
                'multiplier': float(game.multiplier),
                'win_amount': float(game.win_amount),
                'status': game.status,
                'created_at': game.created_at.isoformat(),
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)