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

# ================= WIN RATIO LOGIC =================
def get_card_win_ratio(multiplier, grid_size, matches_found, attempts):
    """
    Calculate dynamic win ratio for card matching game:
    - multiplier: current game multiplier
    - grid_size: size of the grid (more cards = higher potential)
    - matches_found: number of matches already found
    - attempts: number of attempts made
    
    Higher multipliers, larger grids, and more matches found 
    increase chances of better win ratios.
    """
    # Base probabilities
    rand = random.random() * 100
    
    # Difficulty factor: larger grid = harder = better rewards
    difficulty_factor = grid_size / 40  # 16->0.4, 20->0.5, 24->0.6, 30->0.75
    
    # Performance factor: more matches with fewer attempts = better
    if attempts > 0:
        performance_factor = matches_found / attempts
    else:
        performance_factor = 1.0
    
    # Base win tier probabilities
    if rand <= 25:  # 25% chance: Lower tier (10-30%)
        base_ratio = random.uniform(0.10, 0.30)
    elif rand <= 70:  # 45% chance: Normal tier (31-50%)
        base_ratio = random.uniform(0.31, 0.50)
    elif rand <= 90:  # 20% chance: High tier (51-100%)
        base_ratio = random.uniform(0.51, 1.00)
    elif rand <= 97:  # 7% chance: Jackpot tier (101-200%)
        base_ratio = random.uniform(1.01, 2.00)
    else:  # 3% chance: Mega jackpot (201-300%)
        base_ratio = random.uniform(2.01, 3.00)
    
    # Apply bonuses
    final_ratio = base_ratio * (1 + difficulty_factor * 0.5 + performance_factor * 0.3)
    
    # Cap at 350% maximum
    return min(final_ratio, 3.5)


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

        # Check combined balance
        combined_balance = wallet.balance + wallet.spot_balance
        
        if combined_balance < bet_amount:
            return Response({'error': 'Insufficient balance (wallet + spot)'}, status=400)

        # Deduct from spot_balance first, then main balance
        remaining_cost = bet_amount
        
        if wallet.spot_balance >= remaining_cost:
            wallet.spot_balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.spot_balance
            wallet.spot_balance = Decimal("0.00")
            wallet.balance -= remaining_cost
            
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
            'combined_balance': float(wallet.balance + wallet.spot_balance)
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
            
            # Enhanced multiplier calculation
            base_multiplier = Decimal('1.00')
            match_bonus = (Decimal(game.matches_found) / Decimal(total_pairs)) * Decimal('6.00')
            difficulty_bonus = Decimal(str(game.grid_size / 40))  # Larger grid = bigger bonus
            
            game.multiplier = base_multiplier + match_bonus + difficulty_bonus

            # GAME COMPLETED
            if game.matches_found >= total_pairs:
                # Calculate dynamic win ratio
                win_ratio = get_card_win_ratio(
                    float(game.multiplier),
                    game.grid_size,
                    game.matches_found,
                    game.attempts
                )
                
                win_amount = (game.bet_amount * Decimal(str(win_ratio))).quantize(Decimal("0.01"))
                
                # Add time bonus (if you track time)
                # time_bonus = min(game.completion_time / 60, 0.5)  # Up to 50% bonus for speed
                # win_amount = win_amount * Decimal(str(1 + time_bonus))
                
                # Credit winnings to spot_balance
                wallet.spot_balance += win_amount
                wallet.save(update_fields=["spot_balance"])

                game.status = 'completed'
                game.win_amount = win_amount
                game.win_ratio = win_ratio
                game.save()

                # Determine win tier
                win_tier = "normal"
                if win_ratio > 0:
                    if win_ratio <= 0.30:
                        win_tier = "low"
                    elif win_ratio <= 0.50:
                        win_tier = "normal"
                    elif win_ratio <= 1.00:
                        win_tier = "high"
                    elif win_ratio <= 2.00:
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
        if game.attempts >= 3:  # Increased attempts for better gameplay
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
    
    # Get win distribution
    games = CardGame.objects.filter(user=request.user, win_amount__gt=0)
    
    low_wins = games.filter(win_ratio__lte=0.30).count()
    normal_wins = games.filter(win_ratio__gt=0.30, win_ratio__lte=0.50).count()
    high_wins = games.filter(win_ratio__gt=0.50, win_ratio__lte=1.00).count()
    jackpot_wins = games.filter(win_ratio__gt=1.00, win_ratio__lte=2.00).count()
    mega_jackpot_wins = games.filter(win_ratio__gt=2.00).count()
    
    # Calculate success rate
    total = CardGame.objects.filter(user=request.user).count()
    wins = CardGame.objects.filter(user=request.user, status='completed').count()
    success_rate = (wins / total * 100) if total else 0

    return Response({
        'total_games': total_games,
        'total_won': round(total_won, 2),
        'highest_multiplier': float(stats.highest_multiplier),
        'highest_win_ratio': float(stats.highest_win_ratio or 0),
        'success_rate': round(success_rate, 2),
        'avg_win_per_game': round(total_won / total_games, 2) if total_games else 0,
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
            if game.win_ratio <= 0.30:
                win_tier = "low"
            elif game.win_ratio <= 0.50:
                win_tier = "normal"
            elif game.win_ratio <= 1.00:
                win_tier = "high"
            elif game.win_ratio <= 2.00:
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

        # Calculate partial win based on current progress
        total_pairs = game.grid_size // 2
        progress = game.matches_found / total_pairs if total_pairs > 0 else 0
        
        # Base win ratio for partial completion
        base_ratio = get_card_win_ratio(
            float(game.multiplier),
            game.grid_size,
            game.matches_found,
            game.attempts
        )
        
        # Apply progress penalty (you get less for cashing out early)
        progress_penalty = 0.5  # 50% penalty for early cashout
        win_ratio = base_ratio * progress * (1 - progress_penalty)
        
        win_amount = (game.bet_amount * Decimal(str(win_ratio))).quantize(Decimal("0.01"))
        
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