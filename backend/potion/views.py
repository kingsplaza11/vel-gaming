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
LOSS_PROBABILITY = 0.30  # 30% full loss (70% win chance)

POTION_TYPES = {
    "healing": {"name": "Healing Potion", "emoji": "❤️", "preferred_ingredients": ["Moon Dust", "Phoenix Feather"]},
    "mana": {"name": "Mana Potion", "emoji": "🔮", "preferred_ingredients": ["Crystal Shard", "Unicorn Tear"]},
    "strength": {"name": "Strength Potion", "emoji": "💪", "preferred_ingredients": ["Dragon Scale", "Crystal Shard"]},
    "luck": {"name": "Luck Potion", "emoji": "🍀", "preferred_ingredients": ["Unicorn Tear", "Moon Dust"]},
}

INGREDIENTS = [
    {"name": "Moon Dust", "emoji": "🌙", "rarity": "common", "power": 0.6},
    {"name": "Dragon Scale", "emoji": "🐉", "rarity": "rare", "power": 1.0},
    {"name": "Crystal Shard", "emoji": "💎", "rarity": "epic", "power": 1.4},
    {"name": "Phoenix Feather", "emoji": "🪶", "rarity": "legendary", "power": 1.8},
    {"name": "Unicorn Tear", "emoji": "🦄", "rarity": "mythic", "power": 2.2},
]

BAD_INGREDIENTS = [
    {"name": "Toadstool", "emoji": "🍄", "rarity": "cursed", "power": -0.5},
    {"name": "Poison Ivy", "emoji": "🌿", "rarity": "cursed", "power": -0.8},
    {"name": "Rotten Egg", "emoji": "🥚", "rarity": "cursed", "power": -1.0},
]


# ================= WIN MULTIPLIER LOGIC =================
def get_brew_multiplier():
    """
    Returns a win multiplier between 0.5x and 3.5x based on weighted distribution:
    - 40% chance: 0.5x - 1.5x (small potions)
    - 40% chance: 1.6x - 2.5x (good potions)
    - 15% chance: 2.6x - 3.0x (great potions)
    - 5% chance: 3.1x - 3.5x (perfect potions)
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 40:  # 40% chance: Small potions (0.5x - 1.5x)
        return random.uniform(0.5, 1.5)
    elif rand <= 80:  # 40% chance: Good potions (1.6x - 2.5x)
        return random.uniform(1.6, 2.5)
    elif rand <= 95:  # 15% chance: Great potions (2.6x - 3.0x)
        return random.uniform(2.6, 3.0)
    else:  # 5% chance: Perfect potions (3.1x - 3.5x)
        return random.uniform(3.1, 3.5)


def calculate_ingredient_effect(ingredients_used, potion_type):
    """Calculate multiplier effect based on ingredients used"""
    total_power = Decimal("0.0")
    legendary_count = 0
    preferred_matches = 0
    cursed_count = 0
    
    potion_info = POTION_TYPES.get(potion_type, {})
    preferred_ingredients = potion_info.get("preferred_ingredients", [])
    
    for ingredient in ingredients_used:
        # Check if it's a cursed ingredient
        if ingredient.get("rarity") == "cursed":
            cursed_count += 1
            total_power += Decimal(str(ingredient.get("power", 0)))
            continue
            
        # Normal ingredient power
        power = Decimal(str(ingredient.get("power", 1.0)))
        total_power += power
        
        # Rarity tracking
        rarity = ingredient.get("rarity", "common")
        if rarity in ["legendary", "mythic"]:
            legendary_count += 1
        
        # Preferred ingredient match
        if ingredient["name"] in preferred_ingredients:
            preferred_matches += 1
            total_power += Decimal("0.2")  # Bonus for preferred ingredients
    
    # Calculate average power (0.5x to 3.5x range)
    avg_power = total_power / len(ingredients_used) if ingredients_used else Decimal("1.0")
    
    # Cap power within reasonable bounds (0.5 to 3.5)
    final_power = max(Decimal("0.5"), min(Decimal("3.5"), avg_power))
    
    return final_power, legendary_count, preferred_matches, cursed_count


def get_success_level(multiplier):
    """Determine success level based on multiplier"""
    if multiplier <= 0:
        return "cursed"
    elif multiplier <= 1.5:
        return "small"
    elif multiplier <= 2.5:
        return "good"
    elif multiplier <= 3.0:
        return "great"
    else:
        return "perfect"


def select_ingredients():
    """
    Select 3 random ingredients with a chance for cursed ingredients
    70% chance: All normal ingredients
    30% chance: 1 cursed ingredient mixed in (loss)
    """
    roll = random.random()
    
    if roll < 0.70:  # 70% chance: Normal brewing
        # Weighted selection favoring more common ingredients
        ingredients = []
        for _ in range(3):
            # Weighted random: common > rare > epic > legendary > mythic
            rand = random.random()
            if rand < 0.40:  # 40% chance: Common
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "common")
            elif rand < 0.65:  # 25% chance: Rare
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "rare")
            elif rand < 0.85:  # 20% chance: Epic
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "epic")
            elif rand < 0.95:  # 10% chance: Legendary
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "legendary")
            else:  # 5% chance: Mythic
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "mythic")
            ingredients.append(ingredient)
        return ingredients, False  # Not cursed
    else:  # 30% chance: Cursed brewing (loss)
        # Mix 2 normal ingredients with 1 cursed ingredient
        ingredients = []
        # Add 2 normal ingredients
        for _ in range(2):
            rand = random.random()
            if rand < 0.50:  # 50% chance: Common
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "common")
            elif rand < 0.80:  # 30% chance: Rare
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "rare")
            else:  # 20% chance: Epic
                ingredient = next(i for i in INGREDIENTS if i["rarity"] == "epic")
            ingredients.append(ingredient)
        
        # Add 1 cursed ingredient
        cursed_ingredient = random.choice(BAD_INGREDIENTS)
        ingredients.append(cursed_ingredient)
        
        return ingredients, True  # Cursed


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
        # Select ingredients (70% normal, 30% cursed)
        ingredients_used, is_cursed = select_ingredients()
        
        if is_cursed:
            # Cursed brew - immediate loss
            win_multiplier = Decimal("0.00")
            win_amount = Decimal("0.00")
            success_level = "cursed"
            visual_multiplier = Decimal("0.00")
            ingredient_power = Decimal("0.00")
            legendary_count = 0
            preferred_matches = 0
            cursed_count = 1
            base_multiplier = Decimal("0.00")
        else:
            # Normal brewing process
            # Get base multiplier
            base_multiplier = Decimal(str(get_brew_multiplier()))
            
            # Calculate ingredient effects
            ingredient_power, legendary_count, preferred_matches, cursed_count = calculate_ingredient_effect(
                ingredients_used, potion_key
            )
            
            # Blend base multiplier with ingredient power (70% base, 30% ingredients)
            blended_multiplier = (base_multiplier * Decimal("0.7")) + (ingredient_power * Decimal("0.3"))
            
            # Ensure multiplier stays within 0.5x-3.5x range
            final_multiplier = max(Decimal("0.5"), min(Decimal("3.5"), blended_multiplier))
            
            # Calculate win amount
            win_amount = (bet_amount * final_multiplier).quantize(Decimal("0.01"))
            
            # Determine success level
            success_level = get_success_level(float(final_multiplier))
            
            visual_multiplier = final_multiplier

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
            "base_multiplier": float(base_multiplier) if not is_cursed else 0,
            "ingredient_power": float(ingredient_power) if not is_cursed else 0,
            "brew_quality": random.uniform(0.8, 1.2) if not is_cursed else 0,
            "legendary_count": legendary_count,
            "preferred_matches": preferred_matches,
            "cursed_count": cursed_count,
            "success_level": success_level,
            "was_cursed": is_cursed,
        }

        brew = PotionBrew.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            potion_result=potion_result,
            ingredients_used=ingredients_used,
            success_level=success_level,
            win_amount=win_amount,
            win_ratio=float(visual_multiplier),  # Store multiplier as win ratio
        )

        stats, _ = PotionStats.objects.get_or_create(user=request.user)
        stats.total_brews += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        
        # Track success levels using existing fields
        if success_level == "perfect":
            stats.perfect_brews += 1
        elif success_level == "great":
            stats.masterpiece_brews += 1  # Use masterpiece_brews for great brews
        elif success_level == "good":
            stats.good_brews += 1
        elif success_level == "small":
            stats.divine_brews += 1  # Use divine_brews for small brews
        elif success_level == "cursed":
            stats.failed_brews += 1  # Use failed_brews for cursed brews
        
        # Track ingredient stats (only existing fields)
        stats.legendary_ingredients_used += legendary_count
        stats.preferred_ingredient_matches += preferred_matches
        
        # Track highest multiplier
        if visual_multiplier > stats.highest_multiplier:
            stats.highest_multiplier = visual_multiplier
            
        stats.save()

        # Determine win tier for frontend
        win_tier = "loss"
        if visual_multiplier > 0:
            if visual_multiplier <= 1.5:
                win_tier = "small"
            elif visual_multiplier <= 2.5:
                win_tier = "good"
            elif visual_multiplier <= 3.0:
                win_tier = "great"
            else:
                win_tier = "perfect"

        return Response({
            "potion": POTION_TYPES[potion_key],
            "ingredients": ingredients_used,
            "success_level": success_level,
            "win_tier": win_tier,
            "visual_multiplier": float(visual_multiplier),
            "final_multiplier": float(visual_multiplier),
            "win_amount": float(win_amount),
            "win_ratio": float(visual_multiplier),
            "base_multiplier": float(base_multiplier) if not is_cursed else 0,
            "ingredient_power": float(ingredient_power) if not is_cursed else 0,
            "legendary_count": legendary_count,
            "preferred_matches": preferred_matches,
            "cursed_count": cursed_count,
            "was_cursed": is_cursed,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "brew_id": brew.id,
            "game_info": {
                "win_chance": "70%",
                "multiplier_range": "0.5x - 3.5x",
                "cursed_chance": "30%",
                "ingredient_count": len(ingredients_used)
            }
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
        
        # Calculate success rates using existing fields
        perfect_rate = (stats.perfect_brews / total_brews * 100) if total_brews > 0 else 0
        great_rate = (stats.masterpiece_brews / total_brews * 100) if total_brews > 0 else 0  # masterpiece = great
        good_rate = (stats.good_brews / total_brews * 100) if total_brews > 0 else 0
        small_rate = (stats.divine_brews / total_brews * 100) if total_brews > 0 else 0  # divine = small
        cursed_rate = (stats.failed_brews / total_brews * 100) if total_brews > 0 else 0  # failed = cursed
        
        # Overall win rate (non-cursed brews)
        overall_win_rate = ((stats.perfect_brews + stats.masterpiece_brews + stats.good_brews + stats.divine_brews) / 
                           total_brews * 100) if total_brews > 0 else 0
        
        # Calculate profit and ROI
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        
        # Calculate ingredient rates (only existing fields)
        legendary_rate_ing = (stats.legendary_ingredients_used / (total_brews * 3) * 100) if total_brews > 0 else 0
        preferred_match_rate = (stats.preferred_ingredient_matches / (total_brews * 3) * 100) if total_brews > 0 else 0
        
        # Calculate average multiplier
        all_brews = PotionBrew.objects.filter(user=request.user)
        avg_multiplier = all_brews.aggregate(Avg('win_ratio'))['win_ratio__avg'] or 0
        
        return Response({
            'total_brews': total_brews,
            'perfect_brews': stats.perfect_brews,
            'great_brews': stats.masterpiece_brews,  # Using masterpiece for great
            'good_brews': stats.good_brews,
            'small_brews': stats.divine_brews,  # Using divine for small
            'cursed_brews': stats.failed_brews,  # Using failed for cursed
            'perfect_rate': round(perfect_rate, 2),
            'great_rate': round(great_rate, 2),
            'good_rate': round(good_rate, 2),
            'small_rate': round(small_rate, 2),
            'cursed_rate': round(cursed_rate, 2),
            'overall_win_rate': round(overall_win_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'highest_multiplier': round(float(stats.highest_multiplier), 2),
            'avg_multiplier': round(float(avg_multiplier), 2),
            'legendary_ingredients_used': stats.legendary_ingredients_used,
            'legendary_ingredient_rate': round(legendary_rate_ing, 2),
            'preferred_ingredient_matches': stats.preferred_ingredient_matches,
            'preferred_match_rate': round(preferred_match_rate, 2),
            'alchemist_rank': calculate_alchemist_rank(total_brews, stats.perfect_brews, 
                                                      stats.highest_multiplier, overall_win_rate),
            'game_info': {
                'win_chance': '70%',
                'multiplier_range': '0.5x - 3.5x',
                'expected_rtp': '97%',
                'house_edge': '3%'
            }
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
                if brew.win_ratio <= 1.5:
                    win_tier = "small"
                elif brew.win_ratio <= 2.5:
                    win_tier = "good"
                elif brew.win_ratio <= 3.0:
                    win_tier = "great"
                else:
                    win_tier = "perfect"

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
                'base_multiplier': brew.potion_result.get('base_multiplier', 0),
                'ingredient_power': brew.potion_result.get('ingredient_power', 0),
                'brew_quality': brew.potion_result.get('brew_quality', 0),
                'ingredients_used': brew.ingredients_used,
                'legendary_count': brew.potion_result.get('legendary_count', 0),
                'preferred_matches': brew.potion_result.get('preferred_matches', 0),
                'cursed_count': brew.potion_result.get('cursed_count', 0),
                'was_cursed': brew.potion_result.get('was_cursed', False),
                'created_at': brew.created_at.isoformat(),
                'was_profitable': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def calculate_alchemist_rank(total_brews, perfect_brews, highest_multiplier, win_rate):
    """
    Calculate alchemist rank based on brewing stats
    """
    if total_brews >= 50 and perfect_brews >= 10 and highest_multiplier >= 3.5 and win_rate >= 65:
        return "Divine Alchemist ✨"
    elif total_brews >= 30 and perfect_brews >= 5 and highest_multiplier >= 3.0 and win_rate >= 60:
        return "Master Alchemist ⚗️"
    elif total_brews >= 20 and perfect_brews >= 3 and highest_multiplier >= 2.5 and win_rate >= 55:
        return "Expert Potion Master 🔮"
    elif total_brews >= 10 and perfect_brews >= 1 and win_rate >= 50:
        return "Seasoned Brewer 🌟"
    elif total_brews >= 5:
        return "Amateur Mixer 💫"
    else:
        return "Novice Apprentice 🎯"


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_game_info(request):
    """
    Get detailed potion brewing game information
    """
    return Response({
        'game_info': {
            'name': 'Potion Brewing',
            'description': 'Mix ingredients to brew magical potions and win multipliers!',
            'win_chance': '70%',
            'cursed_chance': '30%',
            'multiplier_range': '0.5x - 3.5x',
            'minimum_bet': '100.00',
        },
        'potion_types': [
            {'key': 'healing', 'name': 'Healing Potion', 'emoji': '❤️'},
            {'key': 'mana', 'name': 'Mana Potion', 'emoji': '🔮'},
            {'key': 'strength', 'name': 'Strength Potion', 'emoji': '💪'},
            {'key': 'luck', 'name': 'Luck Potion', 'emoji': '🍀'},
        ],
        'ingredients': [
            {'name': 'Moon Dust', 'emoji': '🌙', 'rarity': 'common', 'power': 0.6},
            {'name': 'Dragon Scale', 'emoji': '🐉', 'rarity': 'rare', 'power': 1.0},
            {'name': 'Crystal Shard', 'emoji': '💎', 'rarity': 'epic', 'power': 1.4},
            {'name': 'Phoenix Feather', 'emoji': '🪶', 'rarity': 'legendary', 'power': 1.8},
            {'name': 'Unicorn Tear', 'emoji': '🦄', 'rarity': 'mythic', 'power': 2.2},
        ],
        'bad_ingredients': [
            {'name': 'Toadstool', 'emoji': '🍄', 'rarity': 'cursed', 'power': -0.5},
            {'name': 'Poison Ivy', 'emoji': '🌿', 'rarity': 'cursed', 'power': -0.8},
            {'name': 'Rotten Egg', 'emoji': '🥚', 'rarity': 'cursed', 'power': -1.0},
        ],
        'multiplier_distribution': {
            'small': '0.5x - 1.5x (40% of wins)',
            'good': '1.6x - 2.5x (40% of wins)',
            'great': '2.6x - 3.0x (15% of wins)',
            'perfect': '3.1x - 3.5x (5% of wins)'
        },
        'ingredient_chances': {
            'common': '40% chance',
            'rare': '25% chance',
            'epic': '20% chance',
            'legendary': '10% chance',
            'mythic': '5% chance'
        },
        'expected_rtp': '97%',
        'house_edge': '3%',
    })