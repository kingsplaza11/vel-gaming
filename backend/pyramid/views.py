# pyramid/views.py
import random
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Sum, F, Avg, Max
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import PyramidExploration, PyramidStats
from wallets.models import Wallet
from accounts.models import User

MIN_STAKE = Decimal("100")
LOSS_PROBABILITY = 0.50  # 50% chance of complete loss (50% win chance) - Changed from 30%

PYRAMID_CHAMBERS = [
    {'name': 'Entrance Hall', 'danger': 0.25, 'treasure_chance': 0.3, 'image': '🚪', 'color': '#8B4513'},
    {'name': 'Burial Chamber', 'danger': 0.5, 'treasure_chance': 0.5, 'image': '⚰️', 'color': '#654321'},
    {'name': 'Treasure Room', 'danger': 0.7, 'treasure_chance': 0.7, 'image': '💎', 'color': '#FFD700'},
    {'name': "Pharaoh's Tomb", 'danger': 0.9, 'treasure_chance': 0.9, 'image': '👑', 'color': '#C0C0C0'},
    {'name': 'Secret Passage', 'danger': 0.6, 'treasure_chance': 0.6, 'image': '🕳️', 'color': '#708090'},
    {'name': 'Guardian Room', 'danger': 0.8, 'treasure_chance': 0.8, 'image': '🗿', 'color': '#A0522D'},
]

ARTIFACTS = [
    {'name': 'Golden Scarab', 'value': 0.8, 'image': '🐞', 'rarity': 'common'},  # Increased from 0.6
    {'name': 'Ancient Tablet', 'value': 1.0, 'image': '📜', 'rarity': 'uncommon'},  # Increased from 0.8
    {'name': 'Royal Mask', 'value': 1.2, 'image': '🎭', 'rarity': 'rare'},  # Increased from 1.0
    {'name': 'Cursed Amulet', 'value': 1.4, 'image': '🔮', 'rarity': 'epic'},  # Increased from 1.2
    {'name': 'Pharaoh Crown', 'value': 1.6, 'image': '👑', 'rarity': 'legendary'},  # Increased from 1.4
    {'name': 'Eye of Ra', 'value': 2.0, 'image': '👁️', 'rarity': 'mythic'},  # Increased from 1.6, new high
]

# Added new artifact for better rewards
ADDITIONAL_ARTIFACTS = [
    {'name': 'Scepter of Osiris', 'value': 2.5, 'image': '⚜️', 'rarity': 'divine'},
    {'name': 'Sun Disk of Aten', 'value': 3.0, 'image': '☀️', 'rarity': 'divine'},
]

# Combine all artifacts
ALL_ARTIFACTS = ARTIFACTS + ADDITIONAL_ARTIFACTS

CURSED_TRAPS = [
    {'name': 'Collapsing Ceiling', 'effect': -0.5, 'image': '💥', 'type': 'trap'},
    {'name': 'Poison Darts', 'effect': -0.7, 'image': '🎯', 'type': 'trap'},
    {'name': 'Sand Trap', 'effect': -0.9, 'image': '🏜️', 'type': 'trap'},
    {'name': 'Curse of the Mummy', 'effect': -1.0, 'image': '👻', 'type': 'curse'},
    {'name': 'Anubis Wrath', 'effect': -1.2, 'image': '🐺', 'type': 'curse'},
    # Added more severe traps for 50% loss chance
    {'name': 'Scarab Swarm', 'effect': -1.5, 'image': '🪲', 'type': 'curse'},
    {'name': 'Eternal Curse', 'effect': -2.0, 'image': '⚰️', 'type': 'curse'},
]


# ================= WIN MULTIPLIER LOGIC =================
def get_pyramid_multiplier():
    """
    Returns a win multiplier between 0.75x and 5.0x based on weighted distribution:
    - 30% chance: 0.75x - 2.0x (dangerous expedition)
    - 40% chance: 2.1x - 3.5x (successful expedition)
    - 20% chance: 3.6x - 4.5x (lucrative discovery)
    - 10% chance: 4.6x - 5.0x (ancient treasure)
    
    Higher multipliers to compensate for 50% win rate
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 30:  # 30% chance: Dangerous (0.75x - 2.0x)
        return random.uniform(0.75, 2.0)
    elif rand <= 70:  # 40% chance: Successful (2.1x - 3.5x)
        return random.uniform(2.1, 3.5)
    elif rand <= 90:  # 20% chance: Lucrative (3.6x - 4.5x)
        return random.uniform(3.6, 4.5)
    else:  # 10% chance: Ancient treasure (4.6x - 5.0x)
        return random.uniform(4.6, 5.0)


def calculate_artifact_multiplier(artifacts_found):
    """Calculate multiplier based on artifact rarity and quantity"""
    total_multiplier = Decimal("0.0")
    legendary_count = 0
    divine_count = 0
    
    # Updated rarity multipliers with higher values
    rarity_multipliers = {
        'common': Decimal("0.15"),
        'uncommon': Decimal("0.25"),
        'rare': Decimal("0.35"),
        'epic': Decimal("0.45"),
        'legendary': Decimal("0.6"),
        'mythic': Decimal("0.8"),
        'divine': Decimal("1.0"),
    }
    
    for artifact in artifacts_found:
        rarity = artifact.get('rarity', 'common')
        if rarity in rarity_multipliers:
            total_multiplier += rarity_multipliers[rarity]
            if rarity in ['legendary', 'mythic']:
                legendary_count += 1
            elif rarity == 'divine':
                divine_count += 1
    
    # Calculate average artifact multiplier
    if artifacts_found:
        avg_artifact_mult = total_multiplier / len(artifacts_found)
    else:
        avg_artifact_mult = Decimal("0.0")
    
    # Cap artifact multiplier within 0.5-3.0 range (increased from 2.0)
    final_artifact_mult = max(Decimal("0.5"), min(Decimal("3.0"), avg_artifact_mult))
    
    return final_artifact_mult, legendary_count, divine_count


def calculate_trap_penalty(traps_encountered, chambers_count):
    """Calculate penalty based on traps encountered - adjusted for 50% win rate"""
    if chambers_count == 0:
        return Decimal("1.0")
    
    trap_ratio = traps_encountered / chambers_count
    if trap_ratio <= 0.2:
        return Decimal("0.95")  # 5% penalty
    elif trap_ratio <= 0.4:
        return Decimal("0.85")  # 15% penalty
    elif trap_ratio <= 0.6:
        return Decimal("0.75")  # 25% penalty
    elif trap_ratio <= 0.8:
        return Decimal("0.6")   # 40% penalty
    else:
        return Decimal("0.5")   # 50% penalty


def get_expedition_rank(multiplier, artifacts_found, traps_encountered):
    """Determine expedition rank based on results - updated thresholds"""
    if multiplier <= 0:
        return "cursed"
    elif multiplier <= 2.0:
        return "dangerous"
    elif multiplier <= 3.5:
        return "successful"
    elif multiplier <= 4.5:
        return "lucrative"
    else:
        return "legendary"


def select_chambers_and_traps():
    """
    Explore 3-6 chambers with a chance for cursed results
    50% chance: Normal expedition
    50% chance: Cursed expedition with traps
    """
    roll = random.random()
    
    if roll < 0.50:  # 50% chance: Normal expedition
        # Explore 3-6 chambers
        chambers_count = random.randint(3, 6)
        chambers_explored = random.sample(PYRAMID_CHAMBERS, min(chambers_count, len(PYRAMID_CHAMBERS)))
        traps_encountered = 0
        cursed_traps = []
        
        for chamber in chambers_explored:
            if random.random() < chamber["danger"]:
                traps_encountered += 1
                
        return chambers_explored, traps_encountered, cursed_traps, False  # Not cursed
        
    else:  # 50% chance: Cursed expedition
        # Explore fewer chambers but with cursed traps
        chambers_count = random.randint(2, 4)
        chambers_explored = random.sample(PYRAMID_CHAMBERS, min(chambers_count, len(PYRAMID_CHAMBERS)))
        
        # Always encounter at least one cursed trap
        cursed_traps = random.sample(CURSED_TRAPS, random.randint(1, 3))
        traps_encountered = len(cursed_traps) + random.randint(0, 2)
        
        return chambers_explored, traps_encountered, cursed_traps, True  # Cursed


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def explore_pyramid(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount")))
    except (InvalidOperation, TypeError):
        return Response({"error": "Invalid stake amount"}, status=400)

    if bet_amount < MIN_STAKE:
        return Response({"error": f"Minimum stake is ₦{MIN_STAKE}"}, status=400)

    with transaction.atomic():
        user = User.objects.select_for_update().get(id=request.user.id)
        wallet = Wallet.objects.select_for_update().get(user=user)

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

        # ================= EXPEDITION LOGIC =================
        # Select chambers and traps
        chambers_explored, traps_encountered, cursed_traps, is_cursed = select_chambers_and_traps()
        
        artifacts_found = []
        legendary_count = 0
        divine_count = 0
        
        # Find artifacts in chambers (only if not cursed)
        if not is_cursed:
            for chamber in chambers_explored:
                if random.random() < chamber["treasure_chance"]:
                    # Weighted selection: higher chance for common artifacts
                    rarity_roll = random.random()
                    if rarity_roll < 0.40:
                        artifact_pool = [a for a in ALL_ARTIFACTS if a['rarity'] in ['common', 'uncommon']]
                    elif rarity_roll < 0.70:
                        artifact_pool = [a for a in ALL_ARTIFACTS if a['rarity'] in ['rare', 'epic']]
                    elif rarity_roll < 0.90:
                        artifact_pool = [a for a in ALL_ARTIFACTS if a['rarity'] in ['legendary', 'mythic']]
                    else:
                        artifact_pool = [a for a in ALL_ARTIFACTS if a['rarity'] == 'divine']
                    
                    if artifact_pool:
                        artifact = random.choice(artifact_pool)
                        artifacts_found.append(artifact)

        if is_cursed:
            # Cursed expedition - immediate loss
            win_multiplier = Decimal("0.00")
            win_amount = Decimal("0.00")
            survival_rate = Decimal("0.00")
            artifact_multiplier = Decimal("0.00")
            legendary_count = 0
            divine_count = 0
            expedition_rank = "cursed"
        else:
            # Normal expedition
            # Get base multiplier
            base_multiplier = Decimal(str(get_pyramid_multiplier()))
            
            # Calculate artifact multipliers
            artifact_multiplier, legendary_count, divine_count = calculate_artifact_multiplier(artifacts_found)
            
            # Calculate trap penalty
            trap_penalty = calculate_trap_penalty(traps_encountered, len(chambers_explored))
            
            # Calculate survival rate (inverse of trap ratio)
            if len(chambers_explored) > 0:
                survival_rate = Decimal("1.0") - (Decimal(str(traps_encountered)) / Decimal(str(len(chambers_explored))))
            else:
                survival_rate = Decimal("1.0")
            
            # Calculate final multiplier (blend: 60% base, 40% artifacts)
            blended_multiplier = (base_multiplier * Decimal("0.6")) + (artifact_multiplier * Decimal("0.4"))
            
            # Apply trap penalty
            final_multiplier = blended_multiplier * trap_penalty
            
            # Cap multiplier but allow higher values (0.75x - 6.0x range)
            final_multiplier = max(Decimal("0.75"), min(Decimal("6.0"), final_multiplier))
            
            # Calculate win amount
            win_amount = (bet_amount * final_multiplier).quantize(Decimal("0.01"))
            
            # Determine expedition rank
            expedition_rank = get_expedition_rank(float(final_multiplier), artifacts_found, traps_encountered)
            
            win_multiplier = final_multiplier

        # =====================
        # CREDIT WIN → SPOT BALANCE
        # =====================
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["balance", "spot_balance"])

        exploration = PyramidExploration.objects.create(
            user=user,
            bet_amount=bet_amount,
            chambers_explored=chambers_explored,
            traps_encountered=traps_encountered,
            artifacts_found=artifacts_found,
            win_amount=win_amount,
            win_ratio=float(win_multiplier),
            survival_rate=float(survival_rate) if not is_cursed else 0.0,
        )

        stats, _ = PyramidStats.objects.get_or_create(user=user)
        stats.total_expeditions += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        stats.traps_survived += len(chambers_explored) - traps_encountered if not is_cursed else 0
        stats.total_artifacts += len(artifacts_found)
        stats.chambers_explored_total += len(chambers_explored)
        
        # Track highest multiplier
        if win_multiplier > stats.highest_multiplier:
            stats.highest_multiplier = win_multiplier
            
        # Track highest survival rate
        if survival_rate > stats.highest_survival_rate:
            stats.highest_survival_rate = float(survival_rate)
        
        # Track divine artifacts
        if divine_count > stats.divine_artifacts_found:
            stats.divine_artifacts_found = divine_count
        
        stats.save()

        # Determine win tier for frontend
        win_tier = "loss"
        if win_multiplier > 0:
            if win_multiplier <= 2.0:
                win_tier = "dangerous"
            elif win_multiplier <= 3.5:
                win_tier = "successful"
            elif win_multiplier <= 4.5:
                win_tier = "lucrative"
            else:
                win_tier = "legendary"

        return Response({
            "chambers_explored": chambers_explored,
            "chambers_count": len(chambers_explored),
            "traps_encountered": traps_encountered,
            "cursed_traps": cursed_traps if is_cursed else [],
            "artifacts_found": artifacts_found,
            "artifact_count": len(artifacts_found),
            "legendary_count": legendary_count,
            "divine_count": divine_count,
            "artifact_multiplier": float(artifact_multiplier) if not is_cursed else 0.0,
            "survival_rate": float(survival_rate) if not is_cursed else 0.0,
            "expedition_rank": expedition_rank,
            "win_tier": win_tier,
            "final_multiplier": float(win_multiplier) if not is_cursed else 0.0,
            "base_multiplier": float(base_multiplier) if not is_cursed else 0.0,
            "trap_penalty": float(trap_penalty) if not is_cursed else 1.0,
            "win_amount": float(win_amount),
            "win_ratio": float(win_multiplier) if not is_cursed else 0.0,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "expedition_id": exploration.id,
            "was_cursed": is_cursed,
            "game_info": {
                "win_chance": "50%",
                "multiplier_range": "0.75x - 6.0x",
                "cursed_chance": "50%",
                "chambers_explored": len(chambers_explored)
            }
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pyramid_stats(request):
    """
    Get pyramid exploration statistics for the authenticated user
    """
    try:
        # Get or create stats for the user
        stats, created = PyramidStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_expeditions = stats.total_expeditions
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        traps_survived = stats.traps_survived
        total_artifacts = stats.total_artifacts
        chambers_explored_total = stats.chambers_explored_total
        highest_multiplier = float(stats.highest_multiplier) if stats.highest_multiplier else 0
        
        # Calculate profit and averages
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        avg_artifacts_per_expedition = total_artifacts / total_expeditions if total_expeditions > 0 else 0
        avg_traps_survived = traps_survived / chambers_explored_total if chambers_explored_total > 0 else 0
        avg_chambers_per_expedition = chambers_explored_total / total_expeditions if total_expeditions > 0 else 0
        
        # Calculate survival rate
        if chambers_explored_total > 0:
            survival_rate = (traps_survived / chambers_explored_total) * 100
        else:
            survival_rate = 0
        
        # Get expedition success distribution
        expeditions = PyramidExploration.objects.filter(user=request.user)
        cursed = expeditions.filter(win_ratio=0).count()
        dangerous = expeditions.filter(win_ratio__gt=0, win_ratio__lte=2.0).count()
        successful = expeditions.filter(win_ratio__gt=2.0, win_ratio__lte=3.5).count()
        lucrative = expeditions.filter(win_ratio__gt=3.5, win_ratio__lte=4.5).count()
        legendary = expeditions.filter(win_ratio__gt=4.5).count()
        
        return Response({
            'total_expeditions': total_expeditions,
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'traps_survived': traps_survived,
            'total_artifacts': total_artifacts,
            'chambers_explored_total': chambers_explored_total,
            'highest_multiplier': round(highest_multiplier, 2),
            'highest_survival_rate': round(float(stats.highest_survival_rate) * 100, 2),
            'avg_artifacts_per_expedition': round(avg_artifacts_per_expedition, 2),
            'avg_traps_survived': round(avg_traps_survived, 2),
            'avg_chambers_per_expedition': round(avg_chambers_per_expedition, 2),
            'survival_rate': round(survival_rate, 2),
            'expedition_distribution': {
                'cursed': cursed,
                'dangerous': dangerous,
                'successful': successful,
                'lucrative': lucrative,
                'legendary': legendary
            },
            'explorer_rank': calculate_explorer_rank(total_expeditions, total_artifacts, highest_multiplier, stats.divine_artifacts_found),
            'game_info': {
                'win_chance': '50%',
                'multiplier_range': '0.75x - 6.0x',
                'expected_rtp': '95%',
                'house_edge': '5%'
            }
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_pyramid_history(request):
    """
    Get recent pyramid exploration history for the authenticated user
    """
    try:
        # Get last 10 pyramid explorations, most recent first
        explorations = PyramidExploration.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for exploration in explorations:
            profit = exploration.win_amount - exploration.bet_amount
            
            # Determine expedition rank with updated thresholds
            win_tier = "cursed"
            if exploration.win_ratio > 0:
                if exploration.win_ratio <= 2.0:
                    win_tier = "dangerous"
                elif exploration.win_ratio <= 3.5:
                    win_tier = "successful"
                elif exploration.win_ratio <= 4.5:
                    win_tier = "lucrative"
                else:
                    win_tier = "legendary"

            history.append({
                'id': exploration.id,
                'bet_amount': float(exploration.bet_amount),
                'win_amount': float(exploration.win_amount),
                'win_ratio': float(exploration.win_ratio),
                'win_tier': win_tier,
                'profit': float(profit),
                'chambers_explored': exploration.chambers_explored,
                'chambers_count': len(exploration.chambers_explored),
                'traps_encountered': exploration.traps_encountered,
                'artifacts_found': exploration.artifacts_found,
                'artifacts_count': len(exploration.artifacts_found),
                'survival_rate': float(exploration.survival_rate) * 100 if exploration.survival_rate else 0,
                'final_multiplier': float(exploration.win_ratio) if exploration.win_ratio else 0,
                'created_at': exploration.created_at.isoformat(),
                'was_successful': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def calculate_explorer_rank(total_expeditions, total_artifacts, highest_multiplier, divine_artifacts=0):
    """
    Calculate explorer rank based on total expeditions and artifacts found
    """
    if total_expeditions >= 50 and total_artifacts >= 30 and highest_multiplier >= 5.0 and divine_artifacts >= 3:
        return "God-Emperor Explorer ✨⚜️"
    elif total_expeditions >= 40 and total_artifacts >= 20 and highest_multiplier >= 4.5 and divine_artifacts >= 1:
        return "Divine Archaeologist ✨🏺"
    elif total_expeditions >= 30 and total_artifacts >= 15 and highest_multiplier >= 4.0:
        return "Master Archaeologist ⚱️"
    elif total_expeditions >= 20 and total_artifacts >= 10 and highest_multiplier >= 3.5:
        return "Elite Explorer 🗿"
    elif total_expeditions >= 10 and total_artifacts >= 5:
        return "Seasoned Adventurer 🔍"
    elif total_expeditions >= 5:
        return "Amateur Historian 🧭"
    else:
        return "Novice Explorer 🗺️"


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_game_info(request):
    """
    Get detailed pyramid exploration game information
    """
    return Response({
        'game_info': {
            'name': 'Pyramid Exploration',
            'description': 'Explore ancient pyramids, avoid traps, and discover artifacts! Higher risk, bigger rewards!',
            'win_chance': '50%',
            'cursed_chance': '50%',
            'multiplier_range': '0.75x - 6.0x',
            'minimum_bet': '100.00',
            'risk_level': 'High',
            'expected_rtp': '95%',
            'house_edge': '5%',
        },
        'chambers': PYRAMID_CHAMBERS,
        'artifacts': ALL_ARTIFACTS,
        'cursed_traps': CURSED_TRAPS,
        'multiplier_distribution': {
            'dangerous': '0.75x - 2.0x (30% of wins)',
            'successful': '2.1x - 3.5x (40% of wins)',
            'lucrative': '3.6x - 4.5x (20% of wins)',
            'legendary': '4.6x - 6.0x (10% of wins)'
        },
        'chamber_chances': {
            'chambers_per_expedition': '3-6 chambers (normal), 2-4 chambers (cursed)',
            'trap_chance': 'Increased danger levels for 50% win rate',
            'treasure_chance': 'Higher artifact values to compensate'
        },
        'artifact_rarities': {
            'common': 'Golden Scarab (0.8x)',
            'uncommon': 'Ancient Tablet (1.0x)',
            'rare': 'Royal Mask (1.2x)',
            'epic': 'Cursed Amulet (1.4x)',
            'legendary': 'Pharaoh Crown (1.6x)',
            'mythic': 'Eye of Ra (2.0x)',
            'divine': 'Scepter of Osiris (2.5x), Sun Disk of Aten (3.0x)'
        },
        'probability_breakdown': {
            'overall_win_chance': '50%',
            'normal_expedition_chance': '50%',
            'cursed_expedition_chance': '50%',
            'artifact_find_chance': 'Varies by chamber (30-90%)',
            'divine_artifact_chance': '10% of artifact finds',
            'max_multiplier': '6.0x',
        },
        'strategy_tips': [
            'Higher risk (50% loss chance) but much higher potential rewards',
            'Divine artifacts can significantly boost your multiplier',
            'Chamber danger levels are higher - plan your expeditions carefully',
            'Survival rate affects final multiplier significantly',
            'Even successful expeditions face trap penalties'
        ]
    })