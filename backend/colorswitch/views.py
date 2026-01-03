import random
import logging
from decimal import Decimal
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from .models import ColorSwitchGame, ColorSwitchStats
from wallets.models import Wallet

logger = logging.getLogger(__name__)

COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']

# ================= WIN RATIO LOGIC =================
def get_color_switch_win_ratio(sequence_length, multiplier):
    """
    Calculate dynamic win ratio based on:
    - sequence_length: current sequence length
    - multiplier: current game multiplier
    
    Longer sequences and higher multipliers increase 
    chances of better win ratios.
    """
    # Base probabilities
    rand = random.random() * 100
    
    # Difficulty factor: longer sequences = higher potential rewards
    difficulty_factor = min((sequence_length - 5) / 10, 0.5)  # Up to 50% bonus
    
    # Multiplier scaling: higher multiplier = better ratio
    multiplier_factor = min((multiplier - 1) / 2, 0.5)  # Cap at 50% bonus
    
    # Base win tier probabilities with difficulty adjustments
    if rand <= 20:  # 20% chance: Lower tier (10-30%)
        base_ratio = random.uniform(0.10, 0.30)
    elif rand <= 70:  # 50% chance: Normal tier (31-50%)
        base_ratio = random.uniform(0.31, 0.50)
    elif rand <= 90:  # 20% chance: High tier (51-120%)
        base_ratio = random.uniform(0.51, 1.20)
    elif rand <= 97:  # 7% chance: Jackpot tier (121-200%)
        base_ratio = random.uniform(1.21, 2.00)
    else:  # 3% chance: Mega jackpot (201-300%)
        base_ratio = random.uniform(2.01, 3.00)
    
    # Apply bonuses
    final_ratio = base_ratio * (1 + difficulty_factor + multiplier_factor)
    
    # Cap at 350% maximum
    return min(final_ratio, 3.5)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_color_switch(request):
    logger.info(f"Start color switch request from user: {request.user.username}")
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        sequence_length = int(request.data.get('sequence_length', 5))
    except Exception as e:
        logger.error(f"Error parsing parameters: {str(e)}")
        return Response({'error': 'Invalid input'}, status=400)

    if bet_amount < Decimal("100"):
        logger.warning(f"Bet amount too low: {bet_amount}")
        return Response({'error': 'Minimum stake is ₦100'}, status=400)

    if sequence_length < 3 or sequence_length > 15:
        logger.warning(f"Invalid sequence length: {sequence_length}")
        return Response({'error': 'Sequence length must be between 3-15'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        logger.info(f"Wallet retrieved: balance={wallet.balance}, spot={wallet.spot_balance}")
        
        # Check combined balance first
        combined_balance = wallet.balance + wallet.spot_balance
        
        logger.info(f"Combined balance: {combined_balance}, Bet amount: {bet_amount}")
        
        if combined_balance < bet_amount:
            logger.warning(f"Insufficient balance: {combined_balance} < {bet_amount}")
            return Response({'error': 'Insufficient balance'}, status=400)

        remaining_cost = bet_amount
        taken_from_wallet = Decimal('0')
        taken_from_spot = Decimal('0')
        
        logger.info(f"Before deduction - Balance: {wallet.balance}, Spot: {wallet.spot_balance}")

        # 1️⃣ Deduct from wallet balance first
        if wallet.balance > 0:
            taken_from_wallet = min(wallet.balance, remaining_cost)
            wallet.balance -= taken_from_wallet
            remaining_cost -= taken_from_wallet
            logger.info(f"Deducted from wallet: {taken_from_wallet}")

        # 2️⃣ If still remaining, deduct from spot balance
        if remaining_cost > 0 and wallet.spot_balance > 0:
            taken_from_spot = min(wallet.spot_balance, remaining_cost)
            wallet.spot_balance -= taken_from_spot
            remaining_cost -= taken_from_spot
            logger.info(f"Deducted from spot: {taken_from_spot}")
            
        wallet.save(update_fields=["balance", "spot_balance"])
        logger.info(f"After deduction - Balance: {wallet.balance}, Spot: {wallet.spot_balance}")

        # Create wallet transaction
        # WalletTransaction.objects.create(
        #     user=request.user,
        #     amount=bet_amount,
        #     tx_type=WalletTransaction.DEBIT,
        #     reference=f"color_switch_bet_{uuid.uuid4().hex[:8]}",
        #     meta={
        #         "reason": "color_switch_bet",
        #         "taken_from_wallet": str(taken_from_wallet),
        #         "taken_from_spot": str(taken_from_spot),
        #         "game_type": "color_switch"
        #     }
        # )

        sequence = [random.choice(COLORS) for _ in range(sequence_length)]

        game = ColorSwitchGame.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            sequence_length=sequence_length,
            current_sequence=sequence,
            multiplier=Decimal("1.0"),
            status="showing"
        )

        logger.info(f"Game created: ID={game.id}, Sequence length={sequence_length}")

        return Response({
            "game_id": game.id,
            "sequence": sequence,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "deduction_breakdown": {
                "from_wallet": float(taken_from_wallet),
                "from_spot": float(taken_from_spot)
            }
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_sequence(request):
    game_id = request.data.get("game_id")
    player_sequence = request.data.get("player_sequence", [])

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = ColorSwitchGame.objects.select_for_update().get(
            id=game_id, user=request.user, status__in=["playing", "showing"]
        )

        if player_sequence != game.current_sequence:
            game.status = "lost"
            game.win_amount = Decimal("0")
            game.win_ratio = 0.0
            game.save()

            stats, _ = ColorSwitchStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.longest_sequence = max(stats.longest_sequence, game.sequence_length)
            stats.save()

            return Response({
                "status": "lost",
                "correct": False,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
            })

        # Correct sequence → increase difficulty and multiplier
        game.sequence_length += 1
        
        # Calculate new multiplier with exponential growth
        multiplier_increase = Decimal("0.15") + (Decimal(game.sequence_length - 5) * Decimal("0.02"))
        new_multiplier = game.multiplier + multiplier_increase
        
        # Generate new sequence
        new_sequence = [random.choice(COLORS) for _ in range(game.sequence_length)]
        
        # Calculate potential win ratio for display
        potential_win_ratio = get_color_switch_win_ratio(
            game.sequence_length, 
            float(new_multiplier)
        )
        
        # Determine potential win tier
        potential_win_tier = "playing"
        if potential_win_ratio > 0:
            if potential_win_ratio <= 0.30:
                potential_win_tier = "low"
            elif potential_win_ratio <= 0.50:
                potential_win_tier = "normal"
            elif potential_win_ratio <= 1.20:
                potential_win_tier = "high"
            elif potential_win_ratio <= 2.00:
                potential_win_tier = "jackpot"
            else:
                potential_win_tier = "mega_jackpot"

        game.multiplier = new_multiplier
        game.current_sequence = new_sequence
        game.status = "showing"
        game.save()

        return Response({
            "status": "correct",
            "correct": True,
            "next_sequence": new_sequence,
            "multiplier": float(new_multiplier),
            "sequence_length": game.sequence_length,
            "potential_win_ratio": potential_win_ratio,
            "potential_win_tier": potential_win_tier,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cash_out_colors(request):
    game_id = request.data.get("game_id")

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = ColorSwitchGame.objects.select_for_update().get(
            id=game_id, user=request.user, status="showing"
        )

        # Calculate dynamic win ratio
        win_ratio = get_color_switch_win_ratio(
            game.sequence_length, 
            float(game.multiplier)
        )
        
        # Base win amount
        win_amount = (game.bet_amount * Decimal(str(win_ratio))).quantize(Decimal("0.01"))
        
        # Apply sequence length bonus (up to 40% extra)
        sequence_bonus = min((game.sequence_length - 5) * 0.05, 0.4)
        win_amount = (win_amount * Decimal(str(1 + sequence_bonus))).quantize(Decimal("0.01"))
        
        # Determine win tier for tracking
        win_tier = "normal"
        if win_ratio > 0:
            if win_ratio <= 0.30:
                win_tier = "low"
            elif win_ratio <= 0.50:
                win_tier = "normal"
            elif win_ratio <= 1.20:
                win_tier = "high"
            elif win_ratio <= 2.00:
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        # Credit winnings to spot_balance
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["spot_balance"])

        game.win_amount = win_amount
        game.win_ratio = win_ratio
        game.status = "cashed_out"
        game.save()

        stats, _ = ColorSwitchStats.objects.get_or_create(user=request.user)
        stats.total_games += 1
        stats.total_won += win_amount
        stats.longest_sequence = max(stats.longest_sequence, game.sequence_length)
        if win_ratio > stats.highest_win_ratio:
            stats.highest_win_ratio = win_ratio
        stats.save()

        return Response({
            "win_amount": float(win_amount),
            "win_ratio": float(win_ratio),
            "win_tier": win_tier,
            "multiplier": float(game.multiplier),
            "sequence_length": game.sequence_length,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
        })


# ================= STATS =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_color_switch_stats(request):
    stats, _ = ColorSwitchStats.objects.get_or_create(user=request.user)
    
    total_games = stats.total_games
    total_won = float(stats.total_won or 0)
    
    # Get win distribution
    games = ColorSwitchGame.objects.filter(user=request.user, win_amount__gt=0)
    
    low_wins = games.filter(win_ratio__lte=0.30).count()
    normal_wins = games.filter(win_ratio__gt=0.30, win_ratio__lte=0.50).count()
    high_wins = games.filter(win_ratio__gt=0.50, win_ratio__lte=1.20).count()
    jackpot_wins = games.filter(win_ratio__gt=1.20, win_ratio__lte=2.00).count()
    mega_jackpot_wins = games.filter(win_ratio__gt=2.00).count()

    return Response({
        "total_games": total_games,
        "total_won": round(total_won, 2),
        "longest_sequence": stats.longest_sequence,
        "highest_win_ratio": float(stats.highest_win_ratio or 0),
        "win_distribution": {
            "low": low_wins,
            "normal": normal_wins,
            "high": high_wins,
            "jackpot": jackpot_wins,
            "mega_jackpot": mega_jackpot_wins
        }
    })


# ================= HISTORY =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_color_switch_history(request):
    games = ColorSwitchGame.objects.filter(
        user=request.user
    ).order_by("-created_at")[:10]

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
            elif game.win_ratio <= 1.20:
                win_tier = "high"
            elif game.win_ratio <= 2.00:
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        history.append({
            "id": game.id,
            "bet_amount": float(game.bet_amount),
            "sequence_length": game.sequence_length,
            "win_amount": float(game.win_amount),
            "win_ratio": float(game.win_ratio),
            "win_tier": win_tier,
            "multiplier": float(game.multiplier),
            "status": game.status,
            "profit": float(profit),
            "created_at": game.created_at.isoformat(),
            "was_profitable": profit > 0,
        })

    return Response({
        "history": history,
        "total_count": len(history),
    })