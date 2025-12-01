import random
import time
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import ColorSwitchGame, ColorSwitchStats
from accounts.models import User

COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']

@api_view(['POST'])
def start_color_switch(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        sequence_length = int(request.data.get('sequence_length', 5))
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
            
            # Generate color sequence
            sequence = [random.choice(COLORS) for _ in range(sequence_length)]
            
            # Create color switch game
            game = ColorSwitchGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                sequence_length=sequence_length,
                current_sequence=sequence
            )
            
            return Response({
                'game_id': game.id,
                'sequence_length': sequence_length,
                'sequence': sequence,
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def submit_sequence(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
        player_sequence = request.data.get('player_sequence', [])
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = ColorSwitchGame.objects.get(id=game_id, user=user, status='playing')
            
            game.player_sequence = player_sequence
            game.save()
            
            # Check if sequences match
            if player_sequence == game.current_sequence:
                # Success - increase sequence length for next round
                new_sequence_length = game.sequence_length + 1
                new_sequence = [random.choice(COLORS) for _ in range(new_sequence_length)]
                
                game.sequence_length = new_sequence_length
                game.current_sequence = new_sequence
                game.player_sequence = []
                game.multiplier = Decimal('1') + (Decimal(str(new_sequence_length - 4)) * Decimal('0.5'))
                game.status = 'showing'
                game.save()
                
                return Response({
                    'correct': True,
                    'new_sequence_length': new_sequence_length,
                    'multiplier': float(game.multiplier),
                    'next_sequence': new_sequence,
                    'status': 'showing'
                })
            else:
                # Failed - game over
                game.status = 'lost'
                game.win_amount = Decimal('0')
                game.save()
                
                # Update stats
                stats, created = ColorSwitchStats.objects.get_or_create(user=user)
                stats.total_games += 1
                if game.sequence_length > stats.longest_sequence:
                    stats.longest_sequence = game.sequence_length
                stats.save()
                
                return Response({
                    'correct': False,
                    'expected_sequence': game.current_sequence,
                    'player_sequence': player_sequence,
                    'status': 'lost',
                    'win_amount': 0,
                    'new_balance': float(user.balance)
                })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def cash_out_colors(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = ColorSwitchGame.objects.get(id=game_id, user=user, status='showing')
            
            # Calculate win amount
            win_amount = game.bet_amount * game.multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            game.status = 'cashed_out'
            game.win_amount = win_amount
            game.save()
            
            # Update stats
            stats, created = ColorSwitchStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_won += win_amount
            if game.sequence_length > stats.longest_sequence:
                stats.longest_sequence = game.sequence_length
            stats.save()
            
            return Response({
                'win_amount': float(win_amount),
                'multiplier': float(game.multiplier),
                'sequence_length_reached': game.sequence_length,
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_color_switch_stats(request):
    """
    Get color switch statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        stats, created = ColorSwitchStats.objects.get_or_create(user=request.user)
        
        return Response({
            'total_games': stats.total_games,
            'total_won': float(stats.total_won),
            'longest_sequence': stats.longest_sequence,
            'avg_win_per_game': float(stats.total_won / stats.total_games) if stats.total_games > 0 else 0,
            'skill_level': calculate_skill_level(stats.longest_sequence)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_color_switch_history(request):
    """
    Get recent color switch game history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        games = ColorSwitchGame.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for game in games:
            history.append({
                'id': game.id,
                'bet_amount': float(game.bet_amount),
                'win_amount': float(game.win_amount),
                'sequence_length': game.sequence_length,
                'multiplier': float(game.multiplier),
                'status': game.status,
                'created_at': game.created_at.isoformat()
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_skill_level(longest_sequence):
    """
    Calculate skill level based on longest sequence achieved
    """
    if longest_sequence >= 15:
        return "Memory Master 🧠"
    elif longest_sequence >= 12:
        return "Color Genius 🎨"
    elif longest_sequence >= 9:
        return "Pattern Pro 🔥"
    elif longest_sequence >= 6:
        return "Quick Learner ⚡"
    else:
        return "Novice Player 🎯"