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

# Updated for 45% above 1.5x and 55% lose/below 1.5x
ABOVE_1_5X_CHANCE = 0.45  # 45% chance to win above 1.5x
BELOW_1_5X_CHANCE = 0.10  # 10% chance to win below 1.5x
LOSS_CHANCE = 0.45  # 45% chance to lose (total 55% lose/below 1.5x)


# Updated treasures with multipliers focused on the new distribution
TREASURES = {
    1: [
        {'name': 'Bronze Coin', 'multiplier': 0.5, 'image': '🪙'},
        {'name': 'Silver Ring', 'multiplier': 0.75, 'image': '💍'},
        {'name': 'Ancient Pottery', 'multiplier': 0.09, 'image': '🏺'},
        {'name': 'Rusty Key', 'multiplier': 0.25, 'image': '🗝️'},
        # Above 1.5x for 45% wins
        {'name': 'Glass Bead', 'multiplier': 0.36, 'image': '🔮'},
        {'name': 'Copper Bracelet', 'multiplier': 0.08, 'image': '📿'},
        {'name': 'Ivory Dice', 'multiplier': 0.09, 'image': '🎲'},
    ],
    2: [
        # All above 1.5x
        {'name': 'Gold Necklace', 'multiplier': 0.09, 'image': '📿'},
        {'name': 'Gemstone', 'multiplier': 0.09, 'image': '💎'},
        {'name': 'Crystal Orb', 'multiplier': 0.25, 'image': '🔮'},
        {'name': 'Silver Amulet', 'multiplier': 0.25, 'image': '🧿'},
    ],
    3: [
        # All above 1.5x
        {'name': 'Royal Crown', 'multiplier': 0.25, 'image': '👑'},
        {'name': 'Dragon Egg', 'multiplier': 0.05, 'image': '🥚'},
        {'name': 'Magic Staff', 'multiplier': 0.09, 'image': '🪄'},
        {'name': 'Gold Chalice', 'multiplier': 0.16, 'image': '🏆'},
    ],
    4: [
        # All above 1.5x
        {'name': 'Phoenix Feather', 'multiplier': 0.09, 'image': '🪶'},
        {'name': 'Unicorn Horn', 'multiplier': 0.25, 'image': '🦄'},
        {'name': 'Mermaid Scale', 'multiplier': 0.25, 'image': '🧜'},
        {'name': 'Star Shard', 'multiplier': 0.09, 'image': '⭐'},
    ],
    5: [
        # All above 1.5x
        {'name': 'Infinity Stone', 'multiplier': 0.09, 'image': '💠'},
        {'name': 'Cosmic Key', 'multiplier': 0.35, 'image': '🔑'},
        {'name': 'Holy Grail', 'multiplier': 0.09, 'image': '🏆'},
        {'name': 'Dragon Scale', 'multiplier': 0.27, 'image': '🐉'},
    ]
}


# ================= WIN MULTIPLIER LOGIC =================
def get_win_multiplier(win_type):
    """
    Returns a win multiplier based on win type:
    - 'above_1_5x': 45% chance, multipliers from 1.6x to 8.0x
    - 'below_1_5x': 10% chance, multipliers from 0.5x to 1.49x
    """
    if win_type == 'above_1_5x':
        # 45% chance - good wins above 1.5x
        rand = random.random()
        if rand < 0.40:  # 40% of above-1.5x wins: 1.6x - 3.0x
            return random.uniform(0.6, 0.25)
        elif rand < 0.70:  # 30% of above-1.5x wins: 3.1x - 4.5x
            return random.uniform(0.26, 0.30)
        elif rand < 0.90:  # 20% of above-1.5x wins: 4.6x - 6.0x
            return random.uniform(0.31, 0.40)
        else:  # 10% of above-1.5x wins: 6.1x - 8.0x
            return random.uniform(0.41, 0.05)
    
    else:  # 'below_1_5x'
        # 10% chance - small wins below 1.5x
        return random.uniform(0.5, 0.09)


def get_win_multiplier_with_map_bonus(map_level, win_type):
    """
    Get win multiplier with map level bonus.
    Higher map levels have better multiplier chances.
    """
    base_multiplier = get_win_multiplier(win_type)
    
    # Map level gives a boost to multiplier range (only for above 1.5x wins)
    if win_type == 'above_1_5x':
        map_boost = (map_level - 1) * 0.25  # 0 to 1.0x boost
        
        # Apply boost with probability (higher levels get more frequent boosts)
        if random.random() < (0.3 + map_level * 0.1):  # 40% to 80% chance of boost
            boosted_multiplier = base_multiplier + map_boost
            # Cap at reasonable maximum
            return min(boosted_multiplier, 9.0)
    
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
        # CORE GAME LOGIC - 45% above 1.5x, 10% below 1.5x, 45% lose
        # =====================
        roll = random.random()
        
        if roll < ABOVE_1_5X_CHANCE:  # 45% chance: win above 1.5x
            win_type = 'above_1_5x'
            is_loss = False
        elif roll < ABOVE_1_5X_CHANCE + BELOW_1_5X_CHANCE:  # 10% chance: win below 1.5x
            win_type = 'below_1_5x'
            is_loss = False
        else:  # 45% chance: lose
            win_type = None
            is_loss = True

        if is_loss:
            win_amount = Decimal("0.00")
            treasures_found = []
            total_multiplier = Decimal("0.00")
            win_multiplier = Decimal("0.00")
        else:
            # Find 1-3 treasures (weighted: 60% 1, 30% 2, 10% 3)
            num_treasures_roll = random.random()
            if num_treasures_roll < 0.60:
                num_treasures = 1
            elif num_treasures_roll < 0.90:
                num_treasures = 2
            else:
                num_treasures = 3
            
            # Randomly select treasures from the map level
            available_treasures = TREASURES[map_level]
            treasures_found = random.sample(available_treasures, k=min(num_treasures, len(available_treasures)))
            
            # Calculate average multiplier from found treasures
            treasure_multipliers = [t["multiplier"] for t in treasures_found]
            average_treasure_multiplier = sum(treasure_multipliers) / len(treasure_multipliers)
            
            # Get win multiplier based on win type
            win_multiplier = Decimal(str(get_win_multiplier_with_map_bonus(map_level, win_type)))
            
            # For above 1.5x wins, ensure multiplier stays above 1.5x
            if win_type == 'above_1_5x':
                win_multiplier = max(Decimal("1.51"), win_multiplier)
            
            # Blend treasure multiplier with win multiplier (weighted 70% win_mult, 30% treasure_mult)
            blended_multiplier = (win_multiplier * Decimal("0.7")) + (Decimal(str(average_treasure_multiplier)) * Decimal("0.3"))
            
            # Cap multipliers
            if win_type == 'above_1_5x':
                final_multiplier = max(Decimal("1.51"), min(Decimal("9.0"), blended_multiplier))
            else:  # below_1_5x
                final_multiplier = min(Decimal("1.49"), blended_multiplier)
            
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
        if not is_loss:
            if win_type == 'below_1_5x':
                win_tier = "small"
            elif total_multiplier <= 3.0:
                win_tier = "low"
            elif total_multiplier <= 5.0:
                win_tier = "normal"
            elif total_multiplier <= 7.0:
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
    
    small_wins = hunts.filter(total_multiplier__lt=1.5).count()
    low_wins = hunts.filter(total_multiplier__gte=1.5, total_multiplier__lte=3.0).count()
    normal_wins = hunts.filter(total_multiplier__gt=3.0, total_multiplier__lte=5.0).count()
    high_wins = hunts.filter(total_multiplier__gt=5.0, total_multiplier__lte=7.0).count()
    great_wins = hunts.filter(total_multiplier__gt=7.0).count()

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
            "small": small_wins,
            "low": low_wins,
            "normal": normal_wins,
            "high": high_wins,
            "great": great_wins
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
            if hunt.total_multiplier < 1.5:
                win_tier = "small"
            elif hunt.total_multiplier <= 3.0:
                win_tier = "low"
            elif hunt.total_multiplier <= 5.0:
                win_tier = "normal"
            elif hunt.total_multiplier <= 7.0:
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
    Get detailed treasure hunt game information
    """
    return Response({
        "game_info": {
            "name": "Treasure Hunt",
            "description": "Explore different maps to find treasures and win!",
            "minimum_bet": "100.00",
            "risk_level": "Medium",
        },
        "map_levels": [
            {
                "level": 1,
                "name": "Beginner Island",
                "cost_multiplier": "1.5x",
                "description": "Easy level with basic treasures"
            },
            {
                "level": 2,
                "name": "Ancient Forest",
                "cost_multiplier": "3.0x",
                "description": "Medium difficulty with better treasures"
            },
            {
                "level": 3,
                "name": "Dragon Mountain",
                "cost_multiplier": "4.5x",
                "description": "Hard level with valuable treasures"
            },
            {
                "level": 4,
                "name": "Phantom Desert",
                "cost_multiplier": "6.0x",
                "description": "Challenging level with mystical treasures"
            },
            {
                "level": 5,
                "name": "Celestial Realm",
                "cost_multiplier": "7.5x",
                "description": "Legendary level with cosmic treasures"
            }
        ],
        "strategy_tips": [
            "Higher map levels offer better treasures",
            "You can find 1-3 treasures per successful hunt",
            "Higher levels have better bonus chances"
        ]
    })