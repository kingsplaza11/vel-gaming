# views.py
import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import SlotGame, SlotStats
from accounts.models import User

# Updated symbol definitions for 3x4 grid
SYMBOLS = {
    'classic': ['seven', 'bar', 'bell', 'cherry', 'orange', 'lemon'],
    'fruit': ['watermelon', 'grapes', 'orange', 'cherry', 'lemon', 'plum'],
    'diamond': ['diamond', 'ruby', 'emerald', 'sapphire', 'gold', 'silver'],
    'ancient': ['scarab', 'pyramid', 'sphinx', 'ankh', 'eye', 'pharaoh']
}

# Enhanced payout system for 3x4 grid
PAYOUTS = {
    'classic': {
        'seven': {'3_match': 10, '4_match': 25, 'line': 50},
        'bar': {'3_match': 8, '4_match': 20, 'line': 40},
        'bell': {'3_match': 6, '4_match': 15, 'line': 30},
        'cherry': {'3_match': 4, '4_match': 10, 'line': 20},
        'orange': {'3_match': 2, '4_match': 5, 'line': 10},
        'lemon': {'3_match': 1, '4_match': 3, 'line': 6}
    },
    'fruit': {
        'watermelon': {'3_match': 12, '4_match': 30, 'line': 60},
        'grapes': {'3_match': 8, '4_match': 20, 'line': 40},
        'orange': {'3_match': 6, '4_match': 15, 'line': 30},
        'cherry': {'3_match': 5, '4_match': 12, 'line': 25},
        'lemon': {'3_match': 3, '4_match': 8, 'line': 16},
        'plum': {'3_match': 2, '4_match': 5, 'line': 10}
    },
    'diamond': {
        'diamond': {'3_match': 15, '4_match': 40, 'line': 80},
        'ruby': {'3_match': 10, '4_match': 25, 'line': 50},
        'emerald': {'3_match': 8, '4_match': 20, 'line': 40},
        'sapphire': {'3_match': 6, '4_match': 15, 'line': 30},
        'gold': {'3_match': 4, '4_match': 10, 'line': 20},
        'silver': {'3_match': 2, '4_match': 5, 'line': 10}
    },
    'ancient': {
        'scarab': {'3_match': 20, '4_match': 50, 'line': 100},
        'pyramid': {'3_match': 12, '4_match': 30, 'line': 60},
        'sphinx': {'3_match': 8, '4_match': 20, 'line': 40},
        'ankh': {'3_match': 6, '4_match': 15, 'line': 30},
        'eye': {'3_match': 4, '4_match': 10, 'line': 20},
        'pharaoh': {'3_match': 3, '4_match': 8, 'line': 16}
    }
}

def calculate_win(reels, theme, bet_amount):
    """
    Calculate win for 3x4 slot grid
    reels: List of 12 symbols representing 4 columns x 3 rows
    """
    win_amount = Decimal('0')
    winning_lines = []
    
    # Check horizontal lines
    for row in range(3):
        line_symbols = [reels[col * 3 + row] for col in range(4)]
        # Check for matches from left
        first_symbol = line_symbols[0]
        match_count = 1
        for i in range(1, 4):
            if line_symbols[i] == first_symbol:
                match_count += 1
            else:
                break
        
        if match_count >= 3:
            payout_key = f"{match_count}_match"
            if payout_key in PAYOUTS[theme][first_symbol]:
                multiplier = PAYOUTS[theme][first_symbol][payout_key]
                win_amount += bet_amount * Decimal(str(multiplier))
                winning_lines.append({
                    'type': f'horizontal_row_{row + 1}',
                    'symbol': first_symbol,
                    'count': match_count,
                    'multiplier': multiplier
                })
    
    # Check vertical lines (for jackpots)
    for col in range(4):
        line_symbols = [reels[col * 3 + row] for row in range(3)]
        if len(set(line_symbols)) == 1:  # All symbols in column are same
            symbol = line_symbols[0]
            multiplier = PAYOUTS[theme][symbol]['line']
            win_amount += bet_amount * Decimal(str(multiplier))
            winning_lines.append({
                'type': f'vertical_column_{col + 1}',
                'symbol': symbol,
                'count': 3,
                'multiplier': multiplier
            })
    
    return win_amount, winning_lines

@api_view(['POST'])
def spin_slots(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

    theme = request.data.get('theme', 'classic')
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
    except:
        return Response({'error': 'Invalid bet amount'}, status=status.HTTP_400_BAD_REQUEST)

    if theme not in SYMBOLS:
        return Response({'error': 'Invalid theme'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)

            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)

            # Deduct bet
            user.balance -= bet_amount
            user.save(update_fields=['balance'])

            # Generate reels
            symbols = SYMBOLS[theme]
            reels = [random.choice(symbols) for _ in range(12)]

            # Calculate winnings
            win_amount, winning_lines = calculate_win(reels, theme, bet_amount)

            # Add winnings
            if win_amount > 0:
                user.balance += win_amount
                user.save(update_fields=['balance'])

            # Record game history
            game = SlotGame.objects.create(
                user=user,
                theme=theme,
                bet_amount=bet_amount,
                win_amount=win_amount,
                result={
                    'reels': reels,
                    'win_amount': float(win_amount),
                    'winning_lines': winning_lines,
                    'grid_size': '3x4'
                }
            )

            # Update stats
            stats, _ = SlotStats.objects.get_or_create(user=user)
            stats.total_spins += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            if win_amount > (stats.biggest_win or 0):
                stats.biggest_win = win_amount
            stats.save()

            return Response({
                'reels': reels,
                'win_amount': float(win_amount),
                'winning_lines': winning_lines,
                'new_balance': float(user.balance)
            }, status=200)

    except Exception as e:
        print("SPIN ERROR:", e)
        return Response({'error': str(e)}, status=500)


@api_view(['GET'])
def get_slot_stats(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    stats, created = SlotStats.objects.get_or_create(user=request.user)
    return Response({
        'total_spins': stats.total_spins,
        'total_won': float(stats.total_won),
        'total_bet': float(stats.total_bet),
        'biggest_win': float(stats.biggest_win) if stats.biggest_win else 0
    })

@api_view(['GET'])
def get_slot_history(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    games = SlotGame.objects.filter(user=request.user).order_by('-created_at')[:20]
    history = []
    for game in games:
        history.append({
            'theme': game.theme,
            'bet_amount': float(game.bet_amount),
            'win_amount': float(game.win_amount),
            'result': game.result,
            'created_at': game.created_at
        })
    return Response(history)