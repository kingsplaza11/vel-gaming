# views.py
import random
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Avg, Max
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import SlotGame, SlotStats
from wallets.models import Wallet

SYMBOLS = {
    'classic': ['seven', 'bar', 'bell', 'cherry', 'orange', 'lemon'],
    'fruit': ['watermelon', 'grapes', 'orange', 'cherry', 'lemon', 'plum'],
    'diamond': ['diamond', 'ruby', 'emerald', 'sapphire', 'gold', 'silver'],
    'ancient': ['scarab', 'pyramid', 'sphinx', 'ankh', 'eye', 'pharaoh']
}

# Paylines configuration
PAYLINES = [
    [0, 1, 2],  # Top row
    [3, 4, 5],  # Middle row  
    [6, 7, 8],  # Bottom row
    [0, 4, 8],  # Diagonal top-left to bottom-right
    [2, 4, 6],  # Diagonal top-right to bottom-left
]

# UPDATED: Multipliers are now all below 1.0 (less than stake)
SYMBOL_MULTIPLIERS = {
    'seven': {'2': 0.2, '3': 0.5, '4': 0.8},
    'bar': {'2': 0.15, '3': 0.4, '4': 0.7},
    'bell': {'2': 0.12, '3': 0.35, '4': 0.6},
    'cherry': {'2': 0.1, '3': 0.3, '4': 0.5},
    'orange': {'2': 0.08, '3': 0.25, '4': 0.4},
    'lemon': {'2': 0.05, '3': 0.2, '4': 0.35},
    'watermelon': {'2': 0.15, '3': 0.4, '4': 0.7},
    'grapes': {'2': 0.12, '3': 0.35, '4': 0.6},
    'plum': {'2': 0.08, '3': 0.25, '4': 0.4},
    'diamond': {'2': 0.2, '3': 0.6, '4': 0.9},
    'ruby': {'2': 0.18, '3': 0.5, '4': 0.8},
    'emerald': {'2': 0.15, '3': 0.4, '4': 0.7},
    'sapphire': {'2': 0.12, '3': 0.35, '4': 0.6},
    'gold': {'2': 0.1, '3': 0.3, '4': 0.5},
    'silver': {'2': 0.08, '3': 0.25, '4': 0.4},
    'scarab': {'2': 0.18, '3': 0.5, '4': 0.8},
    'pyramid': {'2': 0.15, '3': 0.4, '4': 0.7},
    'sphinx': {'2': 0.12, '3': 0.35, '4': 0.6},
    'ankh': {'2': 0.1, '3': 0.3, '4': 0.5},
    'eye': {'2': 0.08, '3': 0.25, '4': 0.4},
    'pharaoh': {'2': 0.05, '3': 0.2, '4': 0.35},
}


def get_slot_multiplier():
    """
    UPDATED: Returns a win multiplier between 0.1x and 0.9x based on weighted distribution:
    - All multipliers are less than 1.0 (cannot win back stake)
    - 40% chance: 0.1x - 0.3x (very small wins)
    - 40% chance: 0.31x - 0.6x (small wins)
    - 15% chance: 0.61x - 0.8x (medium wins)
    - 5% chance: 0.81x - 0.9x (good wins - but still less than stake)
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 40:  # 40% chance: Very small wins (0.1x - 0.3x)
        return random.uniform(0.1, 0.3)
    elif rand <= 80:  # 40% chance: Small wins (0.31x - 0.6x)
        return random.uniform(0.31, 0.6)
    elif rand <= 95:  # 15% chance: Medium wins (0.61x - 0.8x)
        return random.uniform(0.61, 0.8)
    else:  # 5% chance: Good wins (0.81x - 0.9x)
        return random.uniform(0.81, 0.9)


def check_wins(reels, theme, bet_amount):
    """Check for winning combinations across all paylines"""
    total_multiplier = 0
    winning_lines = []
    
    for line_idx, payline in enumerate(PAYLINES):
        symbols_on_line = [reels[pos] for pos in payline]
        
        # Check for matching symbols
        symbol_counts = {}
        for symbol in symbols_on_line:
            symbol_counts[symbol] = symbol_counts.get(symbol, 0) + 1
        
        # Find best matching symbol on this line
        for symbol, count in symbol_counts.items():
            if count >= 2:  # At least 2 matching symbols needed
                multiplier_key = str(count) if count <= 4 else '4'
                line_multiplier = SYMBOL_MULTIPLIERS.get(symbol, {}).get(multiplier_key, 0)
                
                if line_multiplier > 0:
                    total_multiplier += line_multiplier
                    winning_lines.append({
                        'line': line_idx,
                        'symbol': symbol,
                        'count': count,
                        'multiplier': line_multiplier
                    })
    
    # UPDATED: Cap total multiplier to ensure it's always less than 1.0
    total_multiplier = min(total_multiplier, 0.95)
    
    # Calculate win amount (always less than bet amount)
    win_amount = Decimal(str(total_multiplier)) * bet_amount if total_multiplier > 0 else Decimal('0')
    
    return win_amount, winning_lines, total_multiplier


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def spin_slots(request):
    try:
        theme = request.data.get('theme', 'classic')
        bet_amount = Decimal(str(request.data.get('bet_amount', 0)))
    except Exception:
        return Response({'error': 'Invalid parameters'}, status=400)

    if bet_amount <= 0:
        return Response({'error': 'Invalid bet'}, status=400)

    if theme not in SYMBOLS:
        return Response({'error': 'Invalid theme'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        # Check combined balance (wallet + spot_balance)
        combined_balance = wallet.balance + wallet.spot_balance
        if combined_balance < bet_amount:
            return Response({'error': 'Insufficient balance (wallet + spot)'}, status=400)

        # =====================
        # DEDUCT STAKE
        # =====================
        remaining_cost = bet_amount

        if wallet.balance >= remaining_cost:
            wallet.balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.balance
            wallet.balance = Decimal("0.00")
            wallet.spot_balance -= remaining_cost

        # =====================
        # SLOT GAME LOGIC - ADJUSTED WIN PROBABILITY
        # =====================
        # Generate random symbols for the 3x3 grid (9 positions)
        reels = [random.choice(SYMBOLS[theme]) for _ in range(9)]
        
        # Check for normal wins
        win_amount, winning_lines, total_multiplier = check_wins(reels, theme, bet_amount)
        
        # UPDATED: Increased win chance since wins are smaller
        # If no normal win, apply 85% chance for bonus win (but always < stake)
        if win_amount == 0:
            if random.random() < 0.85:  # 85% chance for bonus win (higher frequency)
                bonus_multiplier = Decimal(str(get_slot_multiplier()))
                win_amount = bet_amount * bonus_multiplier
                total_multiplier = float(bonus_multiplier)
                winning_lines = [{
                    'line': 'bonus',
                    'symbol': 'bonus',
                    'count': 3,
                    'multiplier': float(bonus_multiplier)
                }]
        
        # UPDATED: Ensure win amount is always less than bet amount
        win_amount = min(win_amount, bet_amount * Decimal('0.95'))
        win_amount = win_amount.quantize(Decimal("0.01"))
        
        # =====================
        # CREDIT WIN → SPOT BALANCE
        # =====================
        if win_amount > 0:
            wallet.spot_balance += win_amount
        
        wallet.save(update_fields=['balance', 'spot_balance'])

        # Create game record
        game = SlotGame.objects.create(
            user=request.user,
            theme=theme,
            bet_amount=bet_amount,
            win_amount=win_amount,
            multiplier=total_multiplier,
            result={
                'reels': reels,
                'winning_lines': winning_lines,
                'grid': [
                    reels[0:3],  # First row
                    reels[3:6],  # Second row
                    reels[6:9],  # Third row
                ]
            }
        )

        # Update stats
        stats, _ = SlotStats.objects.get_or_create(user=request.user)
        stats.total_spins += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        
        if win_amount > 0:
            stats.winning_spins += 1
            if total_multiplier > stats.highest_multiplier:
                stats.highest_multiplier = total_multiplier
        
        stats.save()

        # UPDATED: Win tier categories adjusted for new multiplier ranges
        win_tier = "loss"
        if total_multiplier > 0:
            if total_multiplier <= 0.3:
                win_tier = "very_small"
            elif total_multiplier <= 0.6:
                win_tier = "small"
            elif total_multiplier <= 0.8:
                win_tier = "medium"
            else:
                win_tier = "good"

        return Response({
            'reels': reels,
            'grid': [
                reels[0:3],  # First row
                reels[3:6],  # Second row
                reels[6:9],  # Third row
            ],
            'winning_lines': winning_lines,
            'win_amount': float(win_amount),
            'multiplier': float(total_multiplier),
            'win_tier': win_tier,
            'wallet_balance': float(wallet.balance),
            'spot_balance': float(wallet.spot_balance),
            'combined_balance': float(wallet.balance + wallet.spot_balance),
            'game_id': game.id,
            'game_info': {
                'win_chance': '85%',
                'multiplier_range': '0.1x - 0.9x',
                'paylines': len(PAYLINES),
                'theme': theme
            }
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_slot_stats(request):
    """Get slot game statistics for the authenticated user"""
    try:
        stats, _ = SlotStats.objects.get_or_create(user=request.user)
        
        total_spins = stats.total_spins
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        
        # Calculate win rate
        win_rate = (stats.winning_spins / total_spins * 100) if total_spins > 0 else 0
        
        # Calculate profit and ROI (will always be negative)
        profit = total_won - total_bet
        roi = (profit / total_bet * 100) if total_bet > 0 else 0
        
        # Get favorite theme
        theme_stats = SlotGame.objects.filter(user=request.user).values('theme').annotate(
            count=Sum('id'),
            total_won=Sum('win_amount'),
            total_bet=Sum('bet_amount')
        ).order_by('-count')
        
        favorite_theme = theme_stats[0]['theme'] if theme_stats else 'classic'
        
        # Calculate average multiplier for wins
        avg_multiplier = SlotGame.objects.filter(
            user=request.user, 
            win_amount__gt=0
        ).aggregate(Avg('multiplier'))['multiplier__avg'] or 0
        
        return Response({
            'total_spins': total_spins,
            'winning_spins': stats.winning_spins,
            'win_rate': round(win_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(profit, 2),
            'roi': round(roi, 2),
            'highest_multiplier': round(float(stats.highest_multiplier), 2),
            'avg_multiplier': round(float(avg_multiplier), 2),
            'favorite_theme': favorite_theme,
            'game_info': {
                'win_chance': '85%',
                'multiplier_range': '0.1x - 0.9x',
                'expected_rtp': '75%',  # Average return to player
                'house_edge': '25%'      # House edge
            }
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_slot_history(request):
    """Get recent slot game history for the authenticated user"""
    try:
        games = SlotGame.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for game in games:
            profit = game.win_amount - game.bet_amount
            
            # UPDATED: Win tier categories adjusted for new multiplier ranges
            win_tier = "loss"
            if game.multiplier > 0:
                if game.multiplier <= 0.3:
                    win_tier = "very_small"
                elif game.multiplier <= 0.6:
                    win_tier = "small"
                elif game.multiplier <= 0.8:
                    win_tier = "medium"
                else:
                    win_tier = "good"

            history.append({
                'id': game.id,
                'theme': game.theme,
                'bet_amount': float(game.bet_amount),
                'win_amount': float(game.win_amount),
                'multiplier': float(game.multiplier),
                'win_tier': win_tier,
                'profit': float(profit),
                'grid': game.result.get('grid', []),
                'winning_lines': game.result.get('winning_lines', []),
                'created_at': game.created_at.isoformat(),
                'was_profitable': profit > 0  # Will always be false now
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_slot_info(request):
    """Get detailed slot game information"""
    return Response({
        'game_info': {
            'name': 'Slot Machine',
            'description': 'Spin the reels and match symbols for small wins!',
            'win_chance': '85%',
            'multiplier_range': '0.1x - 0.9x',
            'minimum_bet': '10.00',
        },
        'themes': [
            {'key': 'classic', 'name': 'Classic Slots', 'symbols': SYMBOLS['classic']},
            {'key': 'fruit', 'name': 'Fruit Slots', 'symbols': SYMBOLS['fruit']},
            {'key': 'diamond', 'name': 'Diamond Slots', 'symbols': SYMBOLS['diamond']},
            {'key': 'ancient', 'name': 'Ancient Slots', 'symbols': SYMBOLS['ancient']},
        ],
        'paylines': [
            {'name': 'Top Row', 'positions': [0, 1, 2]},
            {'name': 'Middle Row', 'positions': [3, 4, 5]},
            {'name': 'Bottom Row', 'positions': [6, 7, 8]},
            {'name': 'Diagonal ↘', 'positions': [0, 4, 8]},
            {'name': 'Diagonal ↙', 'positions': [2, 4, 6]},
        ],
        'multiplier_distribution': {
            'very_small': '0.1x - 0.3x (40% of wins)',
            'small': '0.31x - 0.6x (40% of wins)',
            'medium': '0.61x - 0.8x (15% of wins)',
            'good': '0.81x - 0.9x (5% of wins)'
        },
        'symbol_payouts': {
            'high_value': '0.6x - 0.9x for 3+ matches',
            'medium_value': '0.35x - 0.7x for 3+ matches',
            'low_value': '0.05x - 0.4x for 3+ matches'
        },
        'expected_rtp': '75%',
        'house_edge': '25%',
        'disclaimer': 'All wins are less than your stake. You cannot win back your bet amount.'
    })