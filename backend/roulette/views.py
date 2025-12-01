import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import RouletteGame, RouletteStats
from accounts.models import User

# Roulette wheel numbers (European: 0-36)
ROULETTE_NUMBERS = list(range(37))

# Bet types and their payouts
BET_TYPES = {
    'number': {'payout': 36, 'description': 'Bet on a single number'},
    'red': {'payout': 2, 'description': 'Bet on red numbers'},
    'black': {'payout': 2, 'description': 'Bet on black numbers'},
    'even': {'payout': 2, 'description': 'Bet on even numbers'},
    'odd': {'payout': 2, 'description': 'Bet on odd numbers'},
    'dozen1': {'payout': 3, 'description': 'Bet on 1st dozen (1-12)'},
    'dozen2': {'payout': 3, 'description': 'Bet on 2nd dozen (13-24)'},
    'dozen3': {'payout': 3, 'description': 'Bet on 3rd dozen (25-36)'},
}

# Red and black numbers in European roulette
RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]

@api_view(['POST'])
def spin_roulette(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        bet_type = request.data.get('bet_type', 'number')
        bet_value = request.data.get('bet_value', '0')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if bet_type not in BET_TYPES:
        return Response({'error': 'Invalid bet type'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Spin the wheel
            result = random.choice(ROULETTE_NUMBERS)
            
            # Check win
            win = False
            payout = BET_TYPES[bet_type]['payout']
            
            if bet_type == 'number':
                if result == int(bet_value):
                    win = True
            elif bet_type == 'red':
                if result in RED_NUMBERS:
                    win = True
            elif bet_type == 'black':
                if result in BLACK_NUMBERS:
                    win = True
            elif bet_type == 'even':
                if result % 2 == 0 and result != 0:
                    win = True
            elif bet_type == 'odd':
                if result % 2 == 1:
                    win = True
            elif bet_type == 'dozen1':
                if 1 <= result <= 12:
                    win = True
            elif bet_type == 'dozen2':
                if 13 <= result <= 24:
                    win = True
            elif bet_type == 'dozen3':
                if 25 <= result <= 36:
                    win = True
            
            win_amount = bet_amount * Decimal(payout) if win else Decimal('0')
            
            # Add winnings
            if win:
                user.balance += win_amount
                user.save()
            
            # Create game record
            game = RouletteGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                bet_type=bet_type,
                bet_value=bet_value,
                result=result,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = RouletteStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            stats.save()
            
            return Response({
                'result': result,
                'win': win,
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'game_id': game.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_roulette_stats(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    stats, created = RouletteStats.objects.get_or_create(user=request.user)
    return Response({
        'total_games': stats.total_games,
        'total_won': float(stats.total_won),
        'total_bet': float(stats.total_bet),
    })

@api_view(['GET'])
def get_roulette_history(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    games = RouletteGame.objects.filter(user=request.user).order_by('-created_at')[:10]
    history = []
    for game in games:
        history.append({
            'bet_amount': float(game.bet_amount),
            'bet_type': game.bet_type,
            'bet_value': game.bet_value,
            'result': game.result,
            'win_amount': float(game.win_amount),
            'created_at': game.created_at
        })
    return Response(history)