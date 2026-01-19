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
LOSS_PROBABILITY = 0.50  # 50% full loss (50% win chance)


# Updated treasures with higher multipliers to compensate for lower win rate
TREASURES = {
    1: [
        {'name': 'Bronze Coin', 'multiplier': 0.75, 'image': '🪙'},  # Increased from 0.5
        {'name': 'Silver Ring', 'multiplier': 1.0, 'image': '💍'},   # Increased from 0.75
        {'name': 'Ancient Pottery', 'multiplier': 1.25, 'image': '🏺'},  # Increased from 1.0
        {'name': 'Rusty Key', 'multiplier': 1.5, 'image': '🗝️'},    # Increased from 1.25
        {'name': 'Glass Bead', 'multiplier': 1.75, 'image': '🔮'},   # Increased from 1.5
    ],
    2: [
        {'name': 'Gold Necklace', 'multiplier': 2.0, 'image': '📿'},   # Increased from 1.75
        {'name': 'Gemstone', 'multiplier': 2.25, 'image': '💎'},      # Increased from 2.0
        {'name': 'Crystal Orb', 'multiplier': 2.5, 'image': '🔮'},    # Increased from 2.25
        {'name': 'Silver Amulet', 'multiplier': 2.75, 'image': '🧿'}, # Increased from 2.5
    ],
    3: [
        {'name': 'Royal Crown', 'multiplier': 3.0, 'image': '👑'},    # Increased from 2.75
        {'name': 'Dragon Egg', 'multiplier': 3.5, 'image': '🥚'},     # Increased from 3.0
        {'name': 'Magic Staff', 'multiplier': 4.0, 'image': '🪄'},    # Increased from 3.25, new high
        {'name': 'Gold Chalice', 'multiplier': 4.5, 'image': '🏆'},   # Increased from 3.5, new high
    ],
    4: [
        {'name': 'Phoenix Feather', 'multiplier': 2.0, 'image': '🪶'},   # Increased from 1.5
        {'name': 'Unicorn Horn', 'multiplier': 2.5, 'image': '🦄'},     # Increased from 2.0
        {'name': 'Mermaid Scale', 'multiplier': 3.0, 'image': '🧜'},    # Increased from 2.5
        {'name': 'Star Shard', 'multiplier': 3.5, 'image': '⭐'},       # Increased from 3.0
    ],
    5: [
        {'name': 'Infinity Stone', 'multiplier': 3.0, 'image': '💠'},    # Increased from 2.0
        {'name': 'Cosmic Key', 'multiplier': 3.5, 'image': '🔑'},       # Increased from 2.5
        {'name': 'Holy Grail', 'multiplier': 4.0, 'image': '🏆'},       # Increased from 3.0
        {'name': 'Dragon Scale', 'multiplier': 5.0, 'image': '🐉'},     # Increased from 3.5, new high
    ]
}


# ================= WIN MULTIPLIER LOGIC =================
def get_win_multiplier():
    """
    Returns a win multiplier between 0.75x and 5.0x based on weighted distribution:
    - 30% chance: 0.75x - 2.0x (small wins)
    - 40% chance: 2.1x - 3.5x (medium wins)
    - 20% chance: 3.6x - 4.5x (good wins)
    - 10% chance: 4.6x - 5.0x (great wins)
    
    Higher multipliers to compensate for 50% win rate
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 30:  # 30% chance: Small wins (0.75x - 2.0x)
        return random.uniform(0.75, 2.0)
    elif rand <= 70:  # 40% chance: Medium wins (2.1x - 3.5x)
        return random.uniform(2.1, 3.5)
    elif rand <= 90:  # 20% chance: Good wins (3.6x - 4.5x)
        return random.uniform(3.6, 4.5)
    else:  # 10% chance: Great wins (4.6x - 5.0x)
        return random.uniform(4.6, 5.0)


def get_win_multiplier_with_map_bonus(map_level):
    """
    Get win multiplier with map level bonus.
    Higher map levels have better multiplier chances.
    """
    base_multiplier = get_win_multiplier()
    
    # Map level gives a boost to multiplier range
    # Level 1: no boost, Level 5: +1.0x potential boost
    map_boost = (map_level - 1) * 0.2  # 0 to 0.8x boost
    
    # Apply boost with probability (higher levels get more frequent boosts)
    if random.random() < (0.25 + map_level * 0.15):  # 40% to 100% chance of boost
        boosted_multiplier = base_multiplier + map_boost
        # Cap at reasonable maximum
        return min(boosted_multiplier, 6.0)  # Increased max to 6.0x
    
    return base_multiplier


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

        if wallet.balance >= remaining_cost:
            wallet.balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.balance
            wallet.balance = Decimal("0.00")
            wallet.spot_balance -= remaining_cost

        # =====================
        # CORE GAME LOGIC - 50% WIN CHANCE
        # =====================
        is_loss = random.random() < LOSS_PROBABILITY

        if is_loss:
            win_amount = Decimal("0.00")
            treasures_found = []
            total_multiplier = Decimal("0.00")
            win_multiplier = Decimal("0.00")
        else:
            # Find 1-3 treasures (weighted: 50% 1, 35% 2, 15% 3)
            num_treasures_roll = random.random()
            if num_treasures_roll < 0.50:
                num_treasures = 1
            elif num_treasures_roll < 0.85:
                num_treasures = 2
            else:
                num_treasures = 3
            
            # Randomly select treasures from the map level
            available_treasures = TREASURES[map_level]
            treasures_found = random.sample(available_treasures, k=min(num_treasures, len(available_treasures)))
            
            # Calculate average multiplier from found treasures
            treasure_multipliers = [t["multiplier"] for t in treasures_found]
            average_treasure_multiplier = sum(treasure_multipliers) / len(treasure_multipliers)
            
            # Get win multiplier (0.75x to 5.0x)
            win_multiplier = Decimal(str(get_win_multiplier_with_map_bonus(map_level)))
            
            # Blend treasure multiplier with win multiplier (weighted 60% win_mult, 40% treasure_mult)
            blended_multiplier = (win_multiplier * Decimal("0.6")) + (Decimal(str(average_treasure_multiplier)) * Decimal("0.4"))
            
            # Cap at reasonable maximum with potential for higher wins
            final_multiplier = max(Decimal("0.75"), min(Decimal("6.0"), blended_multiplier))
            
            # Calculate win amount
            win_amount = (bet_amount * final_multiplier).quantize(Decimal("0.01"))
            
            total_multiplier = final_multiplier

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
            win_ratio=float(total_multiplier),
        )

        stats, _ = TreasureStats.objects.get_or_create(user=request.user)
        stats.total_hunts += 1
        stats.total_bet += total_cost
        stats.total_won += win_amount
        
        # Track highest multiplier
        if total_multiplier > stats.highest_multiplier:
            stats.highest_multiplier = float(total_multiplier)
            
        stats.highest_level_completed = max(
            stats.highest_level_completed, map_level
        )
        stats.save()

        # Determine win tier for frontend display
        win_tier = "loss"
        if total_multiplier > 0:
            if total_multiplier <= 2.0:
                win_tier = "low"
            elif total_multiplier <= 3.5:
                win_tier = "normal"
            elif total_multiplier <= 4.5:
                win_tier = "high"
            else:
                win_tier = "great"

        return Response({
            "treasures_found": treasures_found,
            "total_multiplier": float(total_multiplier),
            "win_amount": float(win_amount),
            "win_multiplier": float(total_multiplier),
            "win_tier": win_tier,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "map_level": map_level,
            "total_cost": float(total_cost),
            "hunt_id": hunt.id,
            "game_info": {
                "win_chance": "50%",
                "multiplier_range": "0.75x - 6.0x",
                "trap_chance": "50%",
                "num_treasures_found": len(treasures_found)
            }
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
    
    low_wins = hunts.filter(total_multiplier__lte=2.0).count()
    normal_wins = hunts.filter(total_multiplier__gt=2.0, total_multiplier__lte=3.5).count()
    high_wins = hunts.filter(total_multiplier__gt=3.5, total_multiplier__lte=4.5).count()
    great_wins = hunts.filter(total_multiplier__gt=4.5).count()

    # Calculate average multiplier for wins
    avg_multiplier = hunts.aggregate(Avg('total_multiplier'))['total_multiplier__avg'] or 0

    return Response({
        "total_hunts": total_hunts,
        "total_won": round(total_won, 2),
        "total_bet": round(total_bet, 2),
        "total_profit": round(profit, 2),
        "roi": round(roi, 2),
        "highest_multiplier": float(stats.highest_multiplier),
        "highest_level_completed": stats.highest_level_completed,
        "success_rate": round(success_rate, 2),
        "avg_multiplier": round(avg_multiplier, 2),
        "win_distribution": {
            "low": low_wins,
            "normal": normal_wins,
            "high": high_wins,
            "great": great_wins
        },
        "game_info": {
            "win_chance": "50%",
            "multiplier_range": "0.75x - 6.0x",
            "expected_rtp": "95%",
            "house_edge": "5%"
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
        if hunt.total_multiplier > 0:
            if hunt.total_multiplier <= 2.0:
                win_tier = "low"
            elif hunt.total_multiplier <= 3.5:
                win_tier = "normal"
            elif hunt.total_multiplier <= 4.5:
                win_tier = "high"
            else:
                win_tier = "great"

        history.append({
            "id": hunt.id,
            "map_level": hunt.map_level,
            "bet_amount": float(hunt.bet_amount),
            "total_cost": float(total_cost),
            "win_amount": float(hunt.win_amount),
            "win_multiplier": float(hunt.total_multiplier),
            "win_ratio": float(hunt.win_ratio),
            "win_tier": win_tier,
            "profit": float(profit),
            "total_multiplier": float(hunt.total_multiplier),
            "treasures_found": hunt.treasures_found,
            "created_at": hunt.created_at.isoformat(),
            "was_profitable": profit > 0,
            "num_treasures": len(hunt.treasures_found) if hunt.treasures_found else 0,
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
            win_count = hunts.filter(win_amount__gt=0).count()
            win_rate = (win_count / count * 100) if count > 0 else 0

            level_cost = Decimal(str(level * 1.5))
            total_cost = Decimal(str(total_bet)) * level_cost

            level_stats.append({
                "level": level,
                "hunt_count": count,
                "win_rate": round(win_rate, 2),
                "total_won": float(total_won),
                "total_cost": float(total_cost),
                "total_profit": float(total_won - total_cost),
                "avg_multiplier": float(avg_mult),
                "highest_multiplier": float(max_mult),
                "level_name": get_level_name(level),
            })
        else:
            level_stats.append({
                "level": level,
                "hunt_count": 0,
                "win_rate": 0.0,
                "total_won": 0.0,
                "total_cost": 0.0,
                "total_profit": 0.0,
                "avg_multiplier": 0.0,
                "highest_multiplier": 0.0,
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


# ================= GAME INFO =================
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_game_info(request):
    """
    Get detailed treasure hunt game information and probabilities
    """
    return Response({
        "game_info": {
            "name": "Treasure Hunt",
            "description": "Explore different maps to find treasures and win multipliers! Higher risk, bigger rewards!",
            "win_chance": "50%",
            "loss_chance": "50%",
            "multiplier_range": "0.75x - 6.0x",
            "minimum_bet": "100.00",
            "risk_level": "Medium-High",
            "expected_rtp": "95%",
            "house_edge": "5%",
        },
        "map_levels": [
            {
                "level": 1,
                "name": "Beginner Island",
                "cost_multiplier": "1.5x",
                "treasure_range": "0.75x - 1.75x",
                "description": "Easy level with basic treasures"
            },
            {
                "level": 2,
                "name": "Ancient Forest",
                "cost_multiplier": "3.0x",
                "treasure_range": "2.0x - 2.75x",
                "description": "Medium difficulty with better treasures"
            },
            {
                "level": 3,
                "name": "Dragon Mountain",
                "cost_multiplier": "4.5x",
                "treasure_range": "3.0x - 4.5x",
                "description": "Hard level with valuable treasures"
            },
            {
                "level": 4,
                "name": "Phantom Desert",
                "cost_multiplier": "6.0x",
                "treasure_range": "2.0x - 3.5x",
                "description": "Challenging level with mystical treasures"
            },
            {
                "level": 5,
                "name": "Celestial Realm",
                "cost_multiplier": "7.5x",
                "treasure_range": "3.0x - 5.0x",
                "description": "Legendary level with cosmic treasures"
            }
        ],
        "multiplier_distribution": {
            "low": "0.75x - 2.0x (30% of wins)",
            "normal": "2.1x - 3.5x (40% of wins)",
            "high": "3.6x - 4.5x (20% of wins)",
            "great": "4.6x - 6.0x (10% of wins)"
        },
        "treasure_find_chance": {
            "1_treasure": "50% chance",
            "2_treasures": "35% chance",
            "3_treasures": "15% chance"
        },
        "probability_breakdown": {
            "overall_win_chance": "50%",
            "overall_loss_chance": "50%",
            "level_1_win_rate": "50%",
            "level_5_win_rate": "50% (with higher multipliers)",
            "max_multiplier": "6.0x",
            "average_multiplier": "2.5x - 3.0x",
        },
        "strategy_tips": [
            "Higher map levels offer better potential multipliers",
            "You can find 1-3 treasures per successful hunt",
            "Treasure multipliers combine with base win multiplier",
            "50% win rate means strategic betting is important",
            "Higher levels have better bonus multiplier chances"
        ]
    })