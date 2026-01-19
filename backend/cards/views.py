# cards/views.py
import random
from decimal import Decimal
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import CardGame, CardStats
from wallets.models import Wallet

MIN_BET = Decimal("100.00")
WIN_PROBABILITY = 0.35  # 35% chance of winning

# ================= WIN RATIO LOGIC =================
def get_card_win_ratio():
    """
    Simple win ratio calculation for card matching game:
    - 35% chance of getting any win
    - Win ratios distributed across tiers
    """
    # First check if this is a win (35% chance)
    if random.random() > WIN_PROBABILITY:
        return Decimal("0.00")  # 65% chance of loss
    
    # If it's a win, determine the win tier
    rand = random.random() * 100
    
    if rand <= 40:  # 40% of wins: Small wins (10-30%)
        return Decimal(str(random.uniform(0.10, 0.30)))
    elif rand <= 75:  # 35% of wins: Normal wins (31-50%)
        return Decimal(str(random.uniform(0.31, 0.50)))
    elif rand <= 90:  # 15% of wins: Good wins (51-80%)
        return Decimal(str(random.uniform(0.51, 0.80)))
    elif rand <= 98:  # 8% of wins: Big wins (81-120%)
        return Decimal(str(random.uniform(0.81, 1.20)))
    else:  # 2% of wins: Jackpot wins (121-200%)
        return Decimal(str(random.uniform(1.21, 2.00)))


def create_card_deck(grid_size):
    pairs_count = grid_size // 2
    cards = list(range(1, pairs_count + 1)) * 2
    random.shuffle(cards)
    return cards


# ================= GAME START =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_card_game(request):
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        grid_size = int(request.data.get('grid_size', 16))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=400)

    if bet_amount < MIN_BET:
        return Response({'error': f'Minimum stake is ₦{MIN_BET}'}, status=400)

    if grid_size % 2 != 0 or grid_size < 4:
        return Response({'error': 'Invalid grid size'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        # Check combined balance first
        combined_balance = wallet.balance + wallet.spot_balance
        
        if combined_balance < bet_amount:
            return Response({'error': 'Insufficient balance'}, status=400)

        remaining_cost = bet_amount
        taken_from_wallet = Decimal('0')
        taken_from_spot = Decimal('0')

        # 1️⃣ Deduct from wallet balance first
        if wallet.balance > 0:
            taken_from_wallet = min(wallet.balance, remaining_cost)
            wallet.balance -= taken_from_wallet
            remaining_cost -= taken_from_wallet

        # 2️⃣ If still remaining, deduct from spot balance
        if remaining_cost > 0 and wallet.spot_balance > 0:
            taken_from_spot = min(wallet.spot_balance, remaining_cost)
            wallet.spot_balance -= taken_from_spot
            remaining_cost -= taken_from_spot

        # This should not happen since we checked combined balance, but keep as safety
        if remaining_cost > 0:
            return Response({'error': 'Insufficient funds'}, status=400)

        wallet.save(update_fields=["balance", "spot_balance"])

        cards = create_card_deck(grid_size)

        game = CardGame.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            grid_size=grid_size,
            cards=cards,
            attempts=0,
            matches_found=0,
            multiplier=Decimal('1.00'),
            status='playing'
        )

        return Response({
            'game_id': game.id,
            'grid_size': grid_size,
            'cards_count': len(cards),
            'wallet_balance': float(wallet.balance),
            'spot_balance': float(wallet.spot_balance),
            'combined_balance': float(wallet.balance + wallet.spot_balance),
            'deduction_breakdown': {
                'from_wallet': float(taken_from_wallet),
                'from_spot': float(taken_from_spot)
            }
        })


# ================= REVEAL CARD =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reveal_card(request):
    try:
        game_id = int(request.data.get('game_id'))
        card_index = int(request.data.get('card_index'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = CardGame.objects.select_for_update().get(
            id=game_id,
            user=request.user,
            status='playing'
        )

        cards = game.cards
        revealed = game.revealed_cards or []

        if card_index < 0 or card_index >= len(cards):
            return Response({'error': 'Invalid card index'}, status=400)

        if card_index in revealed:
            return Response({'error': 'Card already revealed'}, status=400)

        revealed.append(card_index)
        game.revealed_cards = revealed

        # FIRST PICK
        if len(revealed) % 2 == 1:
            game.save()
            return Response({
                'card_value': cards[card_index],
                'match_found': None,
                'status': 'playing',
                'wallet_balance': float(wallet.balance),
                'spot_balance': float(wallet.spot_balance),
            })

        # SECOND PICK
        last_two = revealed[-2:]
        game.attempts += 1

        # MATCH FOUND
        if cards[last_two[0]] == cards[last_two[1]]:
            game.matches_found += 1

            total_pairs = len(cards) // 2
            
            # Simple multiplier calculation
            base_multiplier = Decimal('1.00')
            match_bonus = (Decimal(game.matches_found) / Decimal(total_pairs)) * Decimal('2.00')
            
            game.multiplier = base_multiplier + match_bonus

            # GAME COMPLETED
            if game.matches_found >= total_pairs:
                # Calculate win ratio with 35% chance of winning
                win_ratio = get_card_win_ratio()
                
                win_amount = (game.bet_amount * win_ratio).quantize(Decimal("0.01"))
                
                # Credit winnings to spot_balance
                wallet.spot_balance += win_amount
                wallet.save(update_fields=["spot_balance"])

                game.status = 'completed'
                game.win_amount = win_amount
                game.win_ratio = win_ratio
                game.save()

                # Determine win tier
                win_tier = "loss"
                if win_ratio > 0:
                    if win_ratio <= Decimal('0.30'):
                        win_tier = "low"
                    elif win_ratio <= Decimal('0.50'):
                        win_tier = "normal"
                    elif win_ratio <= Decimal('0.80'):
                        win_tier = "high"
                    elif win_ratio <= Decimal('1.20'):
                        win_tier = "jackpot"
                    else:
                        win_tier = "mega_jackpot"

                stats, _ = CardStats.objects.get_or_create(user=request.user)
                stats.total_games += 1
                stats.total_won += win_amount
                stats.highest_multiplier = max(stats.highest_multiplier, game.multiplier)
                if win_ratio > stats.highest_win_ratio:
                    stats.highest_win_ratio = win_ratio
                stats.save()

                return Response({
                    'card_value': cards[card_index],
                    'match_found': True,
                    'matches_found': game.matches_found,
                    'multiplier': float(game.multiplier),
                    'win_amount': float(win_amount),
                    'win_ratio': float(win_ratio),
                    'win_tier': win_tier,
                    'status': 'completed',
                    'wallet_balance': float(wallet.balance),
                    'spot_balance': float(wallet.spot_balance),
                    'combined_balance': float(wallet.balance + wallet.spot_balance)
                })

            game.save()
            return Response({
                'card_value': cards[card_index],
                'match_found': True,
                'matches_found': game.matches_found,
                'multiplier': float(game.multiplier),
                'status': 'playing',
                'wallet_balance': float(wallet.balance),
                'spot_balance': float(wallet.spot_balance),
            })

        # NO MATCH
        if game.attempts >= 3:
            game.status = 'failed'
            game.save()
            return Response({
                'card_value': cards[card_index],
                'match_found': False,
                'status': 'failed',
                'wallet_balance': float(wallet.balance),
                'spot_balance': float(wallet.spot_balance),
            })

        game.save()
        return Response({
            'card_value': cards[card_index],
            'match_found': False,
            'status': 'playing',
            'wallet_balance': float(wallet.balance),
            'spot_balance': float(wallet.spot_balance),
        })


# ================= STATS =================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_card_stats(request):
    stats, _ = CardStats.objects.get_or_create(user=request.user)
    
    total_games = stats.total_games
    total_won = float(stats.total_won or 0)
    
    # Calculate win rate based on 35% probability
    total_completed = CardGame.objects.filter(user=request.user, status='completed').count()
    win_rate = (total_completed / total_games * 100) if total_games > 0 else 0
    
    # Get win distribution
    games = CardGame.objects.filter(user=request.user, win_amount__gt=0)
    
    low_wins = games.filter(win_ratio__lte=0.30).count()
    normal_wins = games.filter(win_ratio__gt=0.30, win_ratio__lte=0.50).count()
    high_wins = games.filter(win_ratio__gt=0.50, win_ratio__lte=0.80).count()
    jackpot_wins = games.filter(win_ratio__gt=0.80, win_ratio__lte=1.20).count()
    mega_jackpot_wins = games.filter(win_ratio__gt=1.20).count()
    
    return Response({
        'total_games': total_games,
        'total_won': round(total_won, 2),
        'win_rate': round(win_rate, 2),
        'highest_multiplier': float(stats.highest_multiplier),
        'highest_win_ratio': float(stats.highest_win_ratio or 0),
        'win_distribution': {
            'low': low_wins,
            'normal': normal_wins,
            'high': high_wins,
            'jackpot': jackpot_wins,
            'mega_jackpot': mega_jackpot_wins
        }
    })


# ================= HISTORY =================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_card_history(request):
    games = CardGame.objects.filter(user=request.user).order_by('-created_at')[:10]

    history = []
    for game in games:
        profit = game.win_amount - game.bet_amount
        
        # Determine win tier
        win_tier = "loss"
        if game.win_ratio > 0:
            if game.win_ratio <= Decimal('0.30'):
                win_tier = "low"
            elif game.win_ratio <= Decimal('0.50'):
                win_tier = "normal"
            elif game.win_ratio <= Decimal('0.80'):
                win_tier = "high"
            elif game.win_ratio <= Decimal('1.20'):
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        history.append({
            'id': game.id,
            'bet_amount': float(game.bet_amount),
            'win_amount': float(game.win_amount),
            'win_ratio': float(game.win_ratio),
            'win_tier': win_tier,
            'grid_size': game.grid_size,
            'matches_found': game.matches_found,
            'multiplier': float(game.multiplier),
            'attempts': game.attempts,
            'status': game.status,
            'profit': float(profit),
            'created_at': game.created_at.isoformat(),
            'was_profitable': profit > 0,
        })

    return Response({
        'history': history,
        'total_count': len(history),
    })


# ================= CASH OUT EARLY =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cash_out_early(request):
    try:
        game_id = int(request.data.get('game_id'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid game ID'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = CardGame.objects.select_for_update().get(
            id=game_id,
            user=request.user,
            status='playing'
        )

        # Calculate win ratio with 35% chance, but reduced for early cashout
        win_ratio = get_card_win_ratio()
        
        # Apply penalty for early cashout
        if win_ratio > 0:
            total_pairs = game.grid_size // 2
            progress = game.matches_found / total_pairs if total_pairs > 0 else 0
            win_ratio = win_ratio * Decimal(str(progress)) * Decimal('0.5')  # 50% penalty
        
        win_amount = (game.bet_amount * win_ratio).quantize(Decimal("0.01"))
        
        # Credit to spot_balance
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["spot_balance"])

        game.status = 'failed'  # Mark as failed since not completed
        game.win_amount = win_amount
        game.win_ratio = win_ratio
        game.save()

        return Response({
            'win_amount': float(win_amount),
            'win_ratio': float(win_ratio),
            'status': 'cashed_out',
            'wallet_balance': float(wallet.balance),
            'spot_balance': float(wallet.spot_balance),
            'combined_balance': float(wallet.balance + wallet.spot_balance)
        })