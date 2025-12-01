import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import GuessingGame, GuessingStats
from accounts.models import User

@api_view(['POST'])
def start_guessing(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        max_number = int(request.data.get('max_number', 100))
        max_attempts = int(request.data.get('max_attempts', 10))
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
            
            # Generate target number
            target_number = random.randint(1, max_number)
            
            # Create guessing game
            game = GuessingGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                target_number=target_number,
                max_number=max_number,
                max_attempts=max_attempts
            )
            
            return Response({
                'game_id': game.id,
                'max_number': max_number,
                'max_attempts': max_attempts,
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def make_guess(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
        guess = int(request.data.get('guess'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = GuessingGame.objects.get(id=game_id, user=user, status='playing')
            
            game.attempts += 1
            game.save()
            
            # Check guess
            if guess == game.target_number:
                # Winner!
                remaining_attempts = game.max_attempts - game.attempts
                multiplier = Decimal('1') + (Decimal(str(remaining_attempts)) / Decimal(str(game.max_attempts))) * Decimal('5')
                game.multiplier = multiplier
                game.status = 'won'
                win_amount = game.bet_amount * multiplier
                game.win_amount = win_amount
                
                # Add winnings
                user.balance += win_amount
                user.save()
                game.save()
                
                # Update stats
                stats, created = GuessingStats.objects.get_or_create(user=user)
                stats.total_games += 1
                stats.total_won += win_amount
                stats.games_won += 1
                stats.save()
                
                return Response({
                    'correct': True,
                    'attempts': game.attempts,
                    'multiplier': float(multiplier),
                    'status': 'won',
                    'win_amount': float(win_amount),
                    'new_balance': float(user.balance)
                })
            else:
                # Check if out of attempts
                if game.attempts >= game.max_attempts:
                    game.status = 'lost'
                    game.win_amount = Decimal('0')
                    game.save()
                    
                    # Update stats
                    stats, created = GuessingStats.objects.get_or_create(user=user)
                    stats.total_games += 1
                    stats.save()
                    
                    return Response({
                        'correct': False,
                        'hint': 'higher' if guess < game.target_number else 'lower',
                        'attempts': game.attempts,
                        'status': 'lost',
                        'target_number': game.target_number,
                        'win_amount': 0,
                        'new_balance': float(user.balance)
                    })
                
                # Provide hint
                hint = 'higher' if guess < game.target_number else 'lower'
                return Response({
                    'correct': False,
                    'hint': hint,
                    'attempts': game.attempts,
                    'remaining_attempts': game.max_attempts - game.attempts,
                    'status': 'playing'
                })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_guessing_stats(request):
    """
    Get guessing game statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        stats, created = GuessingStats.objects.get_or_create(user=request.user)
        
        total_games = stats.total_games
        games_won = stats.games_won
        total_won = float(stats.total_won) if stats.total_won else 0
        
        # Calculate win rate
        win_rate = (games_won / total_games * 100) if total_games > 0 else 0
        
        # Calculate average win
        avg_win = total_won / games_won if games_won > 0 else 0
        
        return Response({
            'total_games': total_games,
            'games_won': games_won,
            'total_won': total_won,
            'win_rate': round(win_rate, 1),
            'avg_win': round(avg_win, 2),
            'player_rank': calculate_player_rank(win_rate)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_guessing_history(request):
    """
    Get recent guessing game history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 guessing games, most recent first
        games = GuessingGame.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for game in games:
            history.append({
                'id': game.id,
                'bet_amount': float(game.bet_amount),
                'win_amount': float(game.win_amount),
                'status': game.status,
                'attempts': game.attempts,
                'max_attempts': game.max_attempts,
                'multiplier': float(game.multiplier) if game.multiplier else 1.0,
                'created_at': game.created_at.isoformat()
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_player_rank(win_rate):
    """
    Calculate player rank based on win rate
    """
    if win_rate >= 80:
        return "Number Master 🎯"
    elif win_rate >= 60:
        return "Guessing Pro 🔥"
    elif win_rate >= 40:
        return "Skilled Guesser 🧠"
    elif win_rate >= 20:
        return "Learning Player 📚"
    else:
        return "Novice Guesser 🎯"