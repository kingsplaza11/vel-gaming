# treasure/views.py
import random
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Sum, Max, Avg, F
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import TreasureHunt, TreasureStats
from wallets.models import Wallet
from accounts.models import User
from accounts.serializers import UserSerializer


# ================= CONSTANTS =================
MIN_STAKE = Decimal("100")
BASE_MAX_WIN_RATIO = Decimal("0.48")  # Base cap
LOSS_PROBABILITY = 0.35  # 35% full loss


TREASURES = {
    1: [
        {'name': 'Bronze Coin', 'multiplier': 1.2, 'image': '🪙'},
        {'name': 'Silver Ring', 'multiplier': 1.5, 'image': '💍'},
        {'name': 'Ancient Pottery', 'multiplier': 1.8, 'image': '🏺'},
    ],
    2: [
        {'name': 'Gold Necklace', 'multiplier': 2.0, 'image': '📿'},
        {'name': 'Gemstone', 'multiplier': 2.5, 'image': '💎'},
        {'name': 'Crystal Orb', 'multiplier': 3.0, 'image': '🔮'},
    ],
    3: [
        {'name': 'Royal Crown', 'multiplier': 4.0, 'image': '👑'},
        {'name': 'Dragon Egg', 'multiplier': 5.0, 'image': '🥚'},
        {'name': 'Magic Staff', 'multiplier': 6.0, 'image': '🪄'},
    ],
    4: [
        {'name': 'Phoenix Feather', 'multiplier': 8.0, 'image': '🪶'},
        {'name': 'Unicorn Horn', 'multiplier': 10.0, 'image': '🦄'},
        {'name': 'Mermaid Scale', 'multiplier': 12.0, 'image': '🧜'},
    ],
    5: [
        {'name': 'Infinity Stone', 'multiplier': 20.0, 'image': '💠'},
        {'name': 'Cosmic Key', 'multiplier': 25.0, 'image': '🔑'},
        {'name': 'Holy Grail', 'multiplier': 50.0, 'image': '🏆'},
    ]
}


# ================= WIN RATIO LOGIC =================
def get_win_ratio():
    """
    Returns a win ratio based on probability distribution:
    - 20% chance: 10-30% (lower tier wins)
    - 60% chance: 31-48% (normal tier wins)
    - 15% chance: 49-100% (high tier wins) 
    - 3% chance: 101-150% (jackpot tier)
    - 2% chance: 151-210% (mega jackpot)
    
    Special consideration: Higher map levels slightly increase 
    chances of better ratios.
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 20:  # 20% chance: Lower tier (10-30%)
        return random.uniform(0.10, 0.30)
    elif rand <= 80:  # 60% chance: Normal tier (31-48%)
        return random.uniform(0.31, 0.48)
    elif rand <= 95:  # 15% chance: High tier (49-100%)
        return random.uniform(0.49, 1.00)
    elif rand <= 98:  # 3% chance: Jackpot tier (101-150%)
        return random.uniform(1.01, 1.50)
    else:  # 2% chance: Mega jackpot (151-210%)
        return random.uniform(1.51, 2.10)


def get_win_ratio_with_map_bonus(map_level):
    """
    Get win ratio with map level bonus.
    Higher map levels increase chances of better ratios.
    """
    base_ratio = get_win_ratio()
    
    # Map level gives a slight boost to win ratio
    # Level 1: no boost, Level 5: +20% potential boost
    map_boost = (map_level - 1) * 0.05  # 0% to 20% boost
    
    # Apply boost with probability (higher levels get more frequent boosts)
    if random.random() < (0.2 + map_level * 0.1):  # 30% to 70% chance of boost
        boosted_ratio = base_ratio * (1 + map_boost)
        # Cap at 300% maximum
        return min(boosted_ratio, 3.0)
    
    return base_ratio


# ================= PROFILE =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


# ================= TREASURE HUNT =================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_hunt(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount")))
        map_level = int(request.data.get("map_level"))
    except Exception:
        return Response({"error": "Invalid parameters"}, status=400)

    if bet_amount < MIN_STAKE:
        return Response({"error": "Minimum stake is ₦100"}, status=400)

    if map_level < 1 or map_level > 5:
        return Response({"error": "Invalid map level"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        level_multiplier = Decimal(str(map_level * 1.5))
        total_cost = (bet_amount * level_multiplier).quantize(Decimal("0.01"))

        # ✅ COMBINED BALANCE
        combined_balance = wallet.balance + wallet.spot_balance

        if combined_balance < total_cost:
            return Response(
                {"error": "Insufficient balance (wallet + spot)"},
                status=400
            )

        # =====================
        # DEDUCT STAKE (spot → wallet)
        # =====================
        remaining_cost = total_cost

        if wallet.spot_balance >= remaining_cost:
            wallet.spot_balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.spot_balance
            wallet.spot_balance = Decimal("0.00")
            wallet.balance -= remaining_cost

        # =====================
        # CORE GAME LOGIC
        # =====================
        is_loss = random.random() < LOSS_PROBABILITY

        if is_loss:
            win_amount = Decimal("0.00")
            treasures_found = []
            total_multiplier = Decimal("0.00")
            win_ratio = Decimal("0.00")
        else:
            treasures_found = random.sample(TREASURES[map_level], k=3)
            total_multiplier = Decimal(
                sum(t["multiplier"] for t in treasures_found)
            )

            # Get dynamic win ratio based on probability
            win_ratio = Decimal(str(get_win_ratio_with_map_bonus(map_level)))
            
            # Calculate win amount
            win_amount = (bet_amount * win_ratio).quantize(Decimal("0.01"))
            
            # Apply a small bonus based on treasures found
            treasure_bonus = Decimal(str(len(treasures_found) * 0.01))  # 1% per treasure
            win_amount = (win_amount * (1 + treasure_bonus)).quantize(Decimal("0.01"))

        # =====================
        # CREDIT WIN → SPOT BALANCE
        # =====================
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["balance", "spot_balance"])

        hunt = TreasureHunt.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            map_level=map_level,
            treasures_found=treasures_found,
            total_multiplier=float(total_multiplier),
            win_amount=win_amount,
            win_ratio=float(win_ratio),  # Store the win ratio for analytics
        )

        stats, _ = TreasureStats.objects.get_or_create(user=request.user)
        stats.total_hunts += 1
        stats.total_bet += total_cost
        stats.total_won += win_amount
        
        # Track highest win ratio
        if win_ratio > stats.highest_win_ratio:
            stats.highest_win_ratio = float(win_ratio)
            
        stats.highest_level_completed = max(
            stats.highest_level_completed, map_level
        )
        stats.highest_multiplier = max(
            stats.highest_multiplier, total_multiplier
        )
        stats.save()

        # Determine win tier for frontend display
        win_tier = "loss"
        if win_ratio > 0:
            if win_ratio <= 0.30:
                win_tier = "low"
            elif win_ratio <= 0.48:
                win_tier = "normal"
            elif win_ratio <= 1.00:
                win_tier = "high"
            elif win_ratio <= 1.50:
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        return Response({
            "treasures_found": treasures_found,
            "total_multiplier": float(total_multiplier),
            "win_amount": float(win_amount),
            "win_ratio": float(win_ratio),
            "win_tier": win_tier,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "map_level": map_level,
            "total_cost": float(total_cost),
            "hunt_id": hunt.id,
        })


# ================= STATS =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_treasure_stats(request):
    stats, _ = TreasureStats.objects.get_or_create(user=request.user)

    total_hunts = stats.total_hunts
    total_won = float(stats.total_won or 0)
    total_bet = float(stats.total_bet or 0)
    profit = total_won - total_bet
    roi = (profit / total_bet * 100) if total_bet > 0 else 0

    successful = TreasureHunt.objects.filter(
        user=request.user,
        win_amount__gt=0
    ).count()

    success_rate = (successful / total_hunts * 100) if total_hunts else 0

    # Get win tier distribution
    hunts = TreasureHunt.objects.filter(user=request.user, win_amount__gt=0)
    
    low_wins = hunts.filter(win_ratio__lte=0.30).count()
    normal_wins = hunts.filter(win_ratio__gt=0.30, win_ratio__lte=0.48).count()
    high_wins = hunts.filter(win_ratio__gt=0.48, win_ratio__lte=1.00).count()
    jackpot_wins = hunts.filter(win_ratio__gt=1.00, win_ratio__lte=1.50).count()
    mega_jackpot_wins = hunts.filter(win_ratio__gt=1.50).count()

    return Response({
        "total_hunts": total_hunts,
        "total_won": round(total_won, 2),
        "total_bet": round(total_bet, 2),
        "total_profit": round(profit, 2),
        "roi": round(roi, 2),
        "highest_multiplier": float(stats.highest_multiplier),
        "highest_win_ratio": float(stats.highest_win_ratio or 0),
        "highest_level_completed": stats.highest_level_completed,
        "success_rate": round(success_rate, 2),
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
def get_treasure_history(request):
    hunts = TreasureHunt.objects.filter(
        user=request.user
    ).order_by("-created_at")[:10]

    history = []
    for hunt in hunts:
        level_multiplier = Decimal(str(hunt.map_level * 1.5))
        total_cost = hunt.bet_amount * level_multiplier
        profit = hunt.win_amount - total_cost
        
        # Determine win tier
        win_tier = "loss"
        if hunt.win_ratio > 0:
            if hunt.win_ratio <= 0.30:
                win_tier = "low"
            elif hunt.win_ratio <= 0.48:
                win_tier = "normal"
            elif hunt.win_ratio <= 1.00:
                win_tier = "high"
            elif hunt.win_ratio <= 1.50:
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        history.append({
            "id": hunt.id,
            "map_level": hunt.map_level,
            "bet_amount": float(hunt.bet_amount),
            "total_cost": float(total_cost),
            "win_amount": float(hunt.win_amount),
            "win_ratio": float(hunt.win_ratio),
            "win_tier": win_tier,
            "profit": float(profit),
            "total_multiplier": float(hunt.total_multiplier),
            "treasures_found": hunt.treasures_found,
            "created_at": hunt.created_at.isoformat(),
            "was_profitable": profit > 0,
        })

    return Response({
        "history": history,
        "total_count": len(history),
    })


# ================= LEVEL STATS =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_level_stats(request):
    level_stats = []

    for level in range(1, 6):
        hunts = TreasureHunt.objects.filter(
            user=request.user, map_level=level
        )

        count = hunts.count()

        if count:
            total_won = hunts.aggregate(Sum("win_amount"))["win_amount__sum"] or 0
            total_bet = hunts.aggregate(Sum("bet_amount"))["bet_amount__sum"] or 0
            avg_mult = hunts.aggregate(Avg("total_multiplier"))["total_multiplier__avg"] or 0
            max_mult = hunts.aggregate(Max("total_multiplier"))["total_multiplier__max"] or 0
            avg_win_ratio = hunts.aggregate(Avg("win_ratio"))["win_ratio__avg"] or 0

            level_cost = Decimal(str(level * 1.5))
            total_cost = Decimal(str(total_bet)) * level_cost

            level_stats.append({
                "level": level,
                "hunt_count": count,
                "total_won": float(total_won),
                "total_cost": float(total_cost),
                "total_profit": float(total_won - total_cost),
                "avg_multiplier": float(avg_mult),
                "highest_multiplier": float(max_mult),
                "avg_win_ratio": float(avg_win_ratio),
                "level_name": get_level_name(level),
            })
        else:
            level_stats.append({
                "level": level,
                "hunt_count": 0,
                "total_won": 0.0,
                "total_cost": 0.0,
                "total_profit": 0.0,
                "avg_multiplier": 0.0,
                "highest_multiplier": 0.0,
                "avg_win_ratio": 0.0,
                "level_name": get_level_name(level),
            })

    return Response({"level_stats": level_stats})


def get_level_name(level):
    return {
        1: "Beginner Island",
        2: "Ancient Forest",
        3: "Dragon Mountain",
        4: "Phantom Desert",
        5: "Celestial Realm",
    }.get(level, f"Level {level}")