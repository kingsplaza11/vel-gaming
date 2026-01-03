# potion/views.py
import random
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Avg, Max
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from wallets.models import Wallet
from .models import PotionBrew, PotionStats

# ================= CONSTANTS =================
MIN_STAKE = Decimal("100")
LOSS_PROBABILITY = 0.35  # 35% full loss

POTION_TYPES = {
    "healing": {"name": "Healing Potion", "emoji": "❤️", "preferred_ingredients": ["Moon Dust", "Phoenix Feather"]},
    "mana": {"name": "Mana Potion", "emoji": "🔮", "preferred_ingredients": ["Crystal Shard", "Unicorn Tear"]},
    "strength": {"name": "Strength Potion", "emoji": "💪", "preferred_ingredients": ["Dragon Scale", "Crystal Shard"]},
    "luck": {"name": "Luck Potion", "emoji": "🍀", "preferred_ingredients": ["Unicorn Tear", "Moon Dust"]},
}

INGREDIENTS = [
    {"name": "Moon Dust", "emoji": "🌙", "rarity": "common", "power": 1.1},
    {"name": "Dragon Scale", "emoji": "🐉", "rarity": "rare", "power": 1.5},
    {"name": "Crystal Shard", "emoji": "💎", "rarity": "epic", "power": 2.0},
    {"name": "Phoenix Feather", "emoji": "🪶", "rarity": "legendary", "power": 2.5},
    {"name": "Unicorn Tear", "emoji": "🦄", "rarity": "mythic", "power": 3.0},
]


# ================= WIN RATIO LOGIC =================
def get_brew_win_ratio():
    """
    Returns a win ratio based on probability distribution:
    - 20% chance: 10-30% (failed brew but some recovery)
    - 55% chance: 31-40% (good brew)
    - 15% chance: 41-100% (perfect brew)
    - 5% chance: 101-180% (masterpiece)
    - 3% chance: 181-250% (legendary brew)
    - 2% chance: 251-350% (divine brew)
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 20:  # 20% chance: Failed brew (10-30%)
        return random.uniform(0.10, 0.30)
    elif rand <= 75:  # 55% chance: Good brew (31-40%)
        return random.uniform(0.31, 0.40)
    elif rand <= 90:  # 15% chance: Perfect brew (41-100%)
        return random.uniform(0.41, 1.00)
    elif rand <= 95:  # 5% chance: Masterpiece (101-180%)
        return random.uniform(1.01, 1.80)
    elif rand <= 98:  # 3% chance: Legendary (181-250%)
        return random.uniform(1.81, 2.50)
    else:  # 2% chance: Divine (251-350%)
        return random.uniform(2.51, 3.50)


def calculate_ingredient_bonus(ingredients_used, potion_type):
    """Calculate bonus based on ingredient rarity and matches"""
    total_bonus = Decimal("0.0")
    legendary_count = 0
    preferred_matches = 0
    
    potion_info = POTION_TYPES.get(potion_type, {})
    preferred_ingredients = potion_info.get("preferred_ingredients", [])
    
    for ingredient in ingredients_used:
        # Rarity bonus
        rarity = ingredient.get("rarity", "common")
        if rarity == "legendary":
            legendary_count += 1
            total_bonus += Decimal("0.10")
        elif rarity == "mythic":
            legendary_count += 1
            total_bonus += Decimal("0.15")
        elif rarity == "epic":
            total_bonus += Decimal("0.05")
        elif rarity == "rare":
            total_bonus += Decimal("0.02")
        
        # Preferred ingredient match bonus
        if ingredient["name"] in preferred_ingredients:
            preferred_matches += 1
            total_bonus += Decimal("0.08")
    
    return total_bonus, legendary_count, preferred_matches


def get_success_level(win_ratio):
    """Determine success level based on win ratio"""
    if win_ratio == 0:
        return "failed"
    elif win_ratio <= 0.30:
        return "failed"
    elif win_ratio <= 0.40:
        return "good"
    elif win_ratio <= 1.00:
        return "perfect"
    elif win_ratio <= 1.80:
        return "masterpiece"
    elif win_ratio <= 2.50:
        return "legendary"
    else:
        return "divine"


# ================= BREW =================
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def brew_potion(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount")))
        potion_key = request.data.get("potion_type")
    except Exception:
        return Response({"error": "Invalid parameters"}, status=400)

    if potion_key not in POTION_TYPES:
        return Response({"error": "Invalid potion type"}, status=400)

    if bet_amount < MIN_STAKE:
        return Response({"error": "Minimum stake is ₦100"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        # Check combined balance (wallet + spot_balance)
        combined_balance = wallet.balance + wallet.spot_balance
        if combined_balance < bet_amount:
            return Response({"error": "Insufficient balance (wallet + spot)"}, status=400)

        # =====================
        # DEDUCT STAKE (spot → wallet)
        # =====================
        remaining_cost = bet_amount

        if wallet.balance >= remaining_cost:
            wallet.balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.balance
            wallet.balance = Decimal("0.00")
            wallet.spot_balance -= remaining_cost

        # ================= GAME LOGIC =================
        is_loss = random.random() < LOSS_PROBABILITY

        # Select 3 random ingredients
        ingredients_used = random.sample(INGREDIENTS, k=3)
        
        if is_loss:
            win_ratio = Decimal("0.00")
            win_amount = Decimal("0.00")
            success_level = "failed"
            visual_multiplier = Decimal("0.00")
            ingredient_bonus = Decimal("0.00")
            legendary_count = 0
            preferred_matches = 0
        else:
            # Get base win ratio
            win_ratio = Decimal(str(get_brew_win_ratio()))
            
            # Calculate ingredient bonuses
            ingredient_bonus, legendary_count, preferred_matches = calculate_ingredient_bonus(
                ingredients_used, potion_key
            )
            
            # Apply ingredient bonus to win ratio
            win_ratio_with_bonus = win_ratio * (1 + ingredient_bonus)
            
            # Cap win ratio at 500% (5x) for safety
            final_win_ratio = min(win_ratio_with_bonus, Decimal("5.00"))
            
            # Calculate win amount
            win_amount = (bet_amount * final_win_ratio).quantize(Decimal("0.01"))
            
            # Determine success level
            success_level = get_success_level(float(final_win_ratio))
            
            # Visual multiplier for frontend display
            visual_multiplier = final_win_ratio

        # =====================
        # CREDIT WIN → SPOT BALANCE
        # =====================
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["balance", "spot_balance"])

        # Prepare potion result data
        potion_result = {
            "potion_type": POTION_TYPES[potion_key]["name"],
            "emoji": POTION_TYPES[potion_key]["emoji"],
            "final_multiplier": float(visual_multiplier),
            "win_ratio": float(win_ratio),
            "final_win_ratio": float(win_ratio + ingredient_bonus),
            "ingredient_bonus": float(ingredient_bonus),
            "brew_skill": random.uniform(0.8, 1.2),  # Random brew quality factor
            "legendary_count": legendary_count,
            "preferred_matches": preferred_matches,
            "success_level": success_level,
        }

        brew = PotionBrew.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            potion_result=potion_result,
            ingredients_used=ingredients_used,
            success_level=success_level,
            win_amount=win_amount,
            win_ratio=float(win_ratio + ingredient_bonus),  # Store total win ratio
        )

        stats, _ = PotionStats.objects.get_or_create(user=request.user)
        stats.total_brews += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        
        # Track success levels
        if success_level == "divine":
            stats.divine_brews += 1
        elif success_level == "legendary":
            stats.legendary_brews += 1
        elif success_level == "masterpiece":
            stats.masterpiece_brews += 1
        elif success_level == "perfect":
            stats.perfect_brews += 1
        elif success_level == "good":
            stats.good_brews += 1
        else:
            stats.failed_brews += 1
        
        # Track ingredient stats
        stats.legendary_ingredients_used += legendary_count
        stats.preferred_ingredient_matches += preferred_matches
        
        # Track highest multiplier
        if visual_multiplier > stats.highest_multiplier:
            stats.highest_multiplier = visual_multiplier
            
        # Track highest win ratio
        total_win_ratio = win_ratio + ingredient_bonus
        if total_win_ratio > stats.highest_win_ratio:
            stats.highest_win_ratio = float(total_win_ratio)
            
        stats.save()

        # Determine win tier for frontend
        win_tier = "loss"
        if total_win_ratio > 0:
            if total_win_ratio <= 0.30:
                win_tier = "failed"
            elif total_win_ratio <= 0.40:
                win_tier = "good"
            elif total_win_ratio <= 1.00:
                win_tier = "perfect"
            elif total_win_ratio <= 1.80:
                win_tier = "masterpiece"
            elif total_win_ratio <= 2.50:
                win_tier = "legendary"
            else:
                win_tier = "divine"

        return Response({
            "potion": POTION_TYPES[potion_key],
            "ingredients": ingredients_used,
            "success_level": success_level,
            "win_tier": win_tier,
            "visual_multiplier": float(visual_multiplier),
            "final_multiplier": float(visual_multiplier),
            "win_amount": float(win_amount),
            "win_ratio": float(total_win_ratio),
            "ingredient_bonus": float(ingredient_bonus),
            "legendary_count": legendary_count,
            "preferred_matches": preferred_matches,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "brew_id": brew.id,
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_potion_stats(request):
    """
    Get potion brewing statistics for the authenticated user
    """
    try:
        # Get or create stats for the user
        stats, created = PotionStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_brews = stats.total_brews
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        
        # Calculate success rates
        divine_rate = (stats.divine_brews / total_brews * 100) if total_brews > 0 else 0
        legendary_rate = (stats.legendary_brews / total_brews * 100) if total_brews > 0 else 0
        masterpiece_rate = (stats.masterpiece_brews / total_brews * 100) if total_brews > 0 else 0
        perfect_rate = (stats.perfect_brews / total_brews * 100) if total_brews > 0 else 0
        good_rate = (stats.good_brews / total_brews * 100) if total_brews > 0 else 0
        failed_rate = (stats.failed_brews / total_brews * 100) if total_brews > 0 else 0
        
        overall_success_rate = ((stats.divine_brews + stats.legendary_brews + stats.masterpiece_brews + 
                                stats.perfect_brews + stats.good_brews) / total_brews * 100) if total_brews > 0 else 0
        
        # Calculate profit and ROI
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        
        # Calculate legendary ingredient rate
        legendary_rate_ing = (stats.legendary_ingredients_used / (total_brews * 3) * 100) if total_brews > 0 else 0
        
        # Calculate preferred match rate
        preferred_match_rate = (stats.preferred_ingredient_matches / (total_brews * 3) * 100) if total_brews > 0 else 0
        
        return Response({
            'total_brews': total_brews,
            'divine_brews': stats.divine_brews,
            'legendary_brews': stats.legendary_brews,
            'masterpiece_brews': stats.masterpiece_brews,
            'perfect_brews': stats.perfect_brews,
            'good_brews': stats.good_brews,
            'failed_brews': stats.failed_brews,
            'divine_rate': round(divine_rate, 2),
            'legendary_rate': round(legendary_rate, 2),
            'masterpiece_rate': round(masterpiece_rate, 2),
            'perfect_rate': round(perfect_rate, 2),
            'good_rate': round(good_rate, 2),
            'failed_rate': round(failed_rate, 2),
            'overall_success_rate': round(overall_success_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'highest_multiplier': round(float(stats.highest_multiplier), 2),
            'highest_win_ratio': round(float(stats.highest_win_ratio), 2),
            'legendary_ingredients_used': stats.legendary_ingredients_used,
            'legendary_ingredient_rate': round(legendary_rate_ing, 2),
            'preferred_ingredient_matches': stats.preferred_ingredient_matches,
            'preferred_match_rate': round(preferred_match_rate, 2),
            'alchemist_rank': calculate_alchemist_rank(total_brews, stats.perfect_brews + stats.masterpiece_brews, 
                                                      stats.highest_multiplier, stats.highest_win_ratio)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_potion_history(request):
    """
    Get recent potion brewing history for the authenticated user
    """
    try:
        # Get last 10 potion brews, most recent first
        brews = PotionBrew.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for brew in brews:
            profit = brew.win_amount - brew.bet_amount
            
            # Determine win tier
            win_tier = "loss"
            if brew.win_ratio > 0:
                if brew.win_ratio <= 0.30:
                    win_tier = "failed"
                elif brew.win_ratio <= 0.40:
                    win_tier = "good"
                elif brew.win_ratio <= 1.00:
                    win_tier = "perfect"
                elif brew.win_ratio <= 1.80:
                    win_tier = "masterpiece"
                elif brew.win_ratio <= 2.50:
                    win_tier = "legendary"
                else:
                    win_tier = "divine"

            history.append({
                'id': brew.id,
                'potion_type': brew.potion_result.get('potion_type', 'Unknown'),
                'bet_amount': float(brew.bet_amount),
                'win_amount': float(brew.win_amount),
                'win_ratio': float(brew.win_ratio),
                'win_tier': win_tier,
                'profit': float(profit),
                'success_level': brew.success_level,
                'final_multiplier': brew.potion_result.get('final_multiplier', 0),
                'brew_skill': brew.potion_result.get('brew_skill', 0),
                'ingredients_used': brew.ingredients_used,
                'legendary_count': brew.potion_result.get('legendary_count', 0),
                'preferred_matches': brew.potion_result.get('preferred_matches', 0),
                'created_at': brew.created_at.isoformat(),
                'was_profitable': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def calculate_alchemist_rank(total_brews, perfect_brews, highest_multiplier, highest_win_ratio):
    """
    Calculate alchemist rank based on total brews, perfect brews, and highest multiplier
    """
    if total_brews >= 50 and perfect_brews >= 15 and highest_win_ratio >= 3.0:
        return "Divine Alchemist ✨"
    elif total_brews >= 30 and perfect_brews >= 8 and highest_win_ratio >= 2.0:
        return "Master Alchemist ⚗️"
    elif total_brews >= 20 and perfect_brews >= 5 and highest_multiplier >= 1.5:
        return "Expert Potion Master 🔮"
    elif total_brews >= 10 and perfect_brews >= 2:
        return "Seasoned Brewer 🌟"
    elif total_brews >= 5:
        return "Amateur Mixer 💫"
    else:
        return "Novice Apprentice 🎯"