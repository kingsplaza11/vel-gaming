# tower/views.py
import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
import logging

from .models import TowerGame, TowerStats
from wallets.models import Wallet

logger = logging.getLogger(__name__)

# ================= WIN RATIO LOGIC =================
def get_tower_win_ratio(height, target_height, multiplier, risk_factor=1.0):
    """
    Calculate dynamic win ratio for tower game:
    - Higher towers get better win ratios
    - Riskier games (higher target) get better potential rewards
    - Multiplier affects final ratio
    
    Probability distribution:
    - 25% chance: 10-30% win ratio (low tier)
    - 50% chance: 31-60% win ratio (normal tier)
    - 15% chance: 61-120% win ratio (high tier)
    - 7% chance: 121-200% win ratio (jackpot tier)
    - 3% chance: 201-300% win ratio (mega jackpot)
    """
    # Base probabilities
    rand = random.random() * 100
    
    # Height factor: higher towers get better ratios
    height_factor = height / max(target_height, 1)  # 0 to 1
    
    # Risk factor: higher target = higher risk = better potential rewards
    risk_factor = (target_height - 5) / 15  # Normalize 5-20 to 0-1
    
    # Multiplier boost: current multiplier affects ratio
    multiplier_factor = min(float(multiplier) / 3.0, 1.0)
    
    # Base win tier
    if rand <= 25:  # 25% chance: Lower tier (10-30%)
        base_ratio = random.uniform(0.10, 0.30)
    elif rand <= 75:  # 50% chance: Normal tier (31-60%)
        base_ratio = random.uniform(0.31, 0.60)
    elif rand <= 90:  # 15% chance: High tier (61-120%)
        base_ratio = random.uniform(0.61, 1.20)
    elif rand <= 97:  # 7% chance: Jackpot tier (121-200%)
        base_ratio = random.uniform(1.21, 2.00)
    else:  # 3% chance: Mega jackpot (201-300%)
        base_ratio = random.uniform(2.01, 3.00)
    
    # Apply bonuses
    height_bonus = height_factor * 0.5  # Up to 50% bonus for reaching high towers
    risk_bonus = risk_factor * 0.3  # Up to 30% bonus for riskier games
    multiplier_bonus = multiplier_factor * 0.2  # Up to 20% bonus for high multiplier
    
    final_ratio = base_ratio * (1 + height_bonus + risk_bonus + multiplier_bonus)
    
    # Cap at 400% maximum
    return min(final_ratio, 4.0)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_tower(request):
    logger.info(f"Tower start request from {request.user.username}")
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        target_height = int(request.data.get('target_height', 10))
    except Exception as e:
        logger.error(f"Invalid parameters: {str(e)}")
        return Response({'error': 'Invalid parameters'}, status=400)

    if bet_amount < Decimal("100"):  # Minimum stake ₦100
        return Response({'error': 'Minimum stake is ₦100'}, status=400)

    if target_height < 5 or target_height > 20:
        return Response({'error': 'Target height must be between 5 and 20'}, status=400)

    try:
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)

            # Check combined balance (wallet + spot)
            combined_balance = wallet.balance + wallet.spot_balance
            
            if combined_balance < bet_amount:
                logger.warning(f"Insufficient balance: {combined_balance} < {bet_amount}")
                return Response({'error': 'Insufficient balance (wallet + spot)'}, status=400)

            # Deduct from spot_balance first, then main balance
            remaining_cost = bet_amount
            
            if wallet.balance >= remaining_cost:
                wallet.balance -= remaining_cost
                remaining_cost = Decimal("0.00")
            else:
                remaining_cost -= wallet.balance
                wallet.balance = Decimal("0.00")
                wallet.spot_balance -= remaining_cost
                
            wallet.save(update_fields=["balance", "spot_balance"])
            logger.info(f"Deducted {bet_amount}, New balance: {wallet.balance}, Spot: {wallet.spot_balance}")

            game = TowerGame.objects.create(
                user=request.user,
                bet_amount=bet_amount,
                target_height=target_height,
                current_height=0,
                multiplier=Decimal("1.0"),
                status="building"
            )

            return Response({
                "game_id": game.id,
                "target_height": target_height,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
                "combined_balance": float(wallet.balance + wallet.spot_balance)
            })

    except Exception as e:
        logger.error(f"Error in start_tower: {str(e)}", exc_info=True)
        return Response({'error': f'Server error: {str(e)}'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def build_level(request):
    logger.info(f"Build level request from {request.user.username}")
    
    try:
        game_id = request.data.get("game_id")
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    try:
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)
            game = TowerGame.objects.select_for_update().get(
                id=game_id, user=request.user, status="building"
            )

            # Calculate crash chance (increases with height)
            base_crash = 0.15  # 15% base chance
            height_risk = game.current_height * 0.08  # 8% increase per level
            max_crash = 0.85  # Maximum 85% crash chance
            crash_chance = min(base_crash + height_risk, max_crash)

            logger.info(f"Game {game_id}: Height {game.current_height}, Crash chance: {crash_chance*100:.1f}%")

            # Check for crash
            if random.random() < crash_chance:
                game.status = "crashed"
                game.win_amount = Decimal("0")
                game.win_ratio = 0.0
                game.save()

                stats, _ = TowerStats.objects.get_or_create(user=request.user)
                stats.total_games += 1
                stats.save()

                return Response({
                    "success": False,
                    "status": "crashed",
                    "current_height": game.current_height,
                    "crash_chance": round(crash_chance * 100, 1),
                    "wallet_balance": float(wallet.balance),
                    "spot_balance": float(wallet.spot_balance),
                })

            # Successful build
            game.current_height += 1

            # Calculate multiplier with exponential growth
            multiplier_growth = Decimal("0.15")  # 15% per level
            raw_multiplier = Decimal("1.0") + (Decimal(game.current_height) * multiplier_growth)
            game.multiplier = raw_multiplier.quantize(Decimal("0.01"))

            game.save()

            # Calculate potential win ratio for display
            risk_factor = (game.target_height - 5) / 15
            potential_win_ratio = get_tower_win_ratio(
                game.current_height, 
                game.target_height, 
                game.multiplier,
                risk_factor
            )
            
            # Determine win tier
            win_tier = "building"
            if potential_win_ratio > 0:
                if potential_win_ratio <= 0.30:
                    win_tier = "low"
                elif potential_win_ratio <= 0.60:
                    win_tier = "normal"
                elif potential_win_ratio <= 1.20:
                    win_tier = "high"
                elif potential_win_ratio <= 2.00:
                    win_tier = "jackpot"
                else:
                    win_tier = "mega_jackpot"

            # Check if target reached
            if game.current_height >= game.target_height:
                # Calculate final win with dynamic ratio
                win_ratio = get_tower_win_ratio(
                    game.current_height, 
                    game.target_height, 
                    game.multiplier,
                    risk_factor
                )
                
                win_amount = (game.bet_amount * Decimal(str(win_ratio))).quantize(Decimal("0.01"))
                
                # Apply achievement bonus for reaching target
                if game.current_height >= game.target_height:
                    win_amount = (win_amount * Decimal("1.2")).quantize(Decimal("0.01"))  # 20% bonus
                
                # Credit to spot_balance
                wallet.spot_balance += win_amount
                wallet.save()

                game.status = "completed"
                game.win_amount = win_amount
                game.win_ratio = win_ratio
                game.save()

                stats, _ = TowerStats.objects.get_or_create(user=request.user)
                stats.total_games += 1
                stats.total_won += win_amount
                stats.highest_tower = max(stats.highest_tower, game.current_height)
                if win_ratio > stats.highest_win_ratio:
                    stats.highest_win_ratio = win_ratio
                if game.multiplier > stats.highest_multiplier:
                    stats.highest_multiplier = game.multiplier
                stats.save()
                
                # Determine final win tier
                final_win_tier = "normal"
                if win_ratio > 0:
                    if win_ratio <= 0.30:
                        final_win_tier = "low"
                    elif win_ratio <= 0.60:
                        final_win_tier = "normal"
                    elif win_ratio <= 1.20:
                        final_win_tier = "high"
                    elif win_ratio <= 2.00:
                        final_win_tier = "jackpot"
                    else:
                        final_win_tier = "mega_jackpot"

                return Response({
                    "success": True,
                    "status": "completed",
                    "current_height": game.current_height,
                    "multiplier": float(game.multiplier),
                    "win_amount": float(win_amount),
                    "win_ratio": float(win_ratio),
                    "win_tier": final_win_tier,
                    "wallet_balance": float(wallet.balance),
                    "spot_balance": float(wallet.spot_balance),
                    "combined_balance": float(wallet.balance + wallet.spot_balance)
                })

            return Response({
                "success": True,
                "status": "building",
                "current_height": game.current_height,
                "multiplier": float(game.multiplier),
                "crash_chance": round(crash_chance * 100, 1),
                "potential_win_ratio": potential_win_ratio,
                "potential_win_tier": win_tier,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
            })

    except Exception as e:
        logger.error(f"Error in build_level: {str(e)}", exc_info=True)
        return Response({'error': f'Server error: {str(e)}'}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cash_out_tower(request):
    logger.info(f"Cash out request from {request.user.username}")
    
    try:
        game_id = request.data.get("game_id")
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    try:
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)
            game = TowerGame.objects.select_for_update().get(
                id=game_id, user=request.user, status="building"
            )

            # Calculate dynamic win ratio based on current state
            risk_factor = (game.target_height - 5) / 15
            win_ratio = get_tower_win_ratio(
                game.current_height, 
                game.target_height, 
                game.multiplier,
                risk_factor
            )
            
            win_amount = (game.bet_amount * Decimal(str(win_ratio))).quantize(Decimal("0.01"))
            
            # Apply cashout bonus (10% less than if completed target)
            cashout_deduction = Decimal("0.10")
            win_amount = (win_amount * (Decimal("1.0") - cashout_deduction)).quantize(Decimal("0.01"))

            # Credit to spot_balance
            wallet.spot_balance += win_amount
            wallet.save()

            game.status = "cashed_out"
            game.win_amount = win_amount
            game.win_ratio = win_ratio
            game.save()

            stats, _ = TowerStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.total_won += win_amount
            stats.highest_tower = max(stats.highest_tower, game.current_height)
            if win_ratio > stats.highest_win_ratio:
                stats.highest_win_ratio = win_ratio
            if game.multiplier > stats.highest_multiplier:
                stats.highest_multiplier = game.multiplier
            stats.save()
            
            # Determine win tier
            win_tier = "normal"
            if win_ratio > 0:
                if win_ratio <= 0.30:
                    win_tier = "low"
                elif win_ratio <= 0.60:
                    win_tier = "normal"
                elif win_ratio <= 1.20:
                    win_tier = "high"
                elif win_ratio <= 2.00:
                    win_tier = "jackpot"
                else:
                    win_tier = "mega_jackpot"

            return Response({
                "win_amount": float(win_amount),
                "win_ratio": float(win_ratio),
                "win_tier": win_tier,
                "multiplier": float(game.multiplier),
                "height_reached": game.current_height,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
                "combined_balance": float(wallet.balance + wallet.spot_balance)
            })

    except Exception as e:
        logger.error(f"Error in cash_out_tower: {str(e)}", exc_info=True)
        return Response({'error': f'Server error: {str(e)}'}, status=500)


# ================= STATS =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_tower_stats(request):
    stats, _ = TowerStats.objects.get_or_create(user=request.user)
    
    total_games = stats.total_games
    total_won = float(stats.total_won or 0)
    
    # Get win distribution
    games = TowerGame.objects.filter(user=request.user, win_amount__gt=0)
    
    low_wins = games.filter(win_ratio__lte=0.30).count()
    normal_wins = games.filter(win_ratio__gt=0.30, win_ratio__lte=0.60).count()
    high_wins = games.filter(win_ratio__gt=0.60, win_ratio__lte=1.20).count()
    jackpot_wins = games.filter(win_ratio__gt=1.20, win_ratio__lte=2.00).count()
    mega_jackpot_wins = games.filter(win_ratio__gt=2.00).count()

    return Response({
        "total_games": total_games,
        "total_won": round(total_won, 2),
        "highest_tower": stats.highest_tower,
        "highest_multiplier": float(stats.highest_multiplier),
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
def get_tower_history(request):
    games = TowerGame.objects.filter(
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
            elif game.win_ratio <= 0.60:
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
            "current_height": game.current_height,
            "target_height": game.target_height,
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