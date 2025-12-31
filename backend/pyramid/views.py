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
LOSS_PROBABILITY = 0.25  # 25% chance of complete loss

PYRAMID_CHAMBERS = [
    {'name': 'Entrance Hall', 'danger': 0.15, 'treasure_chance': 0.3, 'image': '🚪', 'color': '#8B4513'},
    {'name': 'Burial Chamber', 'danger': 0.4, 'treasure_chance': 0.5, 'image': '⚰️', 'color': '#654321'},
    {'name': 'Treasure Room', 'danger': 0.65, 'treasure_chance': 0.7, 'image': '💎', 'color': '#FFD700'},
    {'name': "Pharaoh's Tomb", 'danger': 0.85, 'treasure_chance': 0.9, 'image': '👑', 'color': '#C0C0C0'},
    {'name': 'Secret Passage', 'danger': 0.5, 'treasure_chance': 0.6, 'image': '🕳️', 'color': '#708090'},
    {'name': 'Guardian Room', 'danger': 0.7, 'treasure_chance': 0.8, 'image': '🗿', 'color': '#A0522D'},
]

ARTIFACTS = [
    {'name': 'Golden Scarab', 'value': 1.1, 'image': '🐞', 'rarity': 'common'},
    {'name': 'Ancient Tablet', 'value': 1.15, 'image': '📜', 'rarity': 'uncommon'},
    {'name': 'Royal Mask', 'value': 1.2, 'image': '🎭', 'rarity': 'rare'},
    {'name': 'Cursed Amulet', 'value': 1.3, 'image': '🔮', 'rarity': 'epic'},
    {'name': 'Pharaoh Crown', 'value': 1.5, 'image': '👑', 'rarity': 'legendary'},
    {'name': 'Eye of Ra', 'value': 2.0, 'image': '👁️', 'rarity': 'mythic'},
]


# ================= WIN RATIO LOGIC =================
def get_pyramid_win_ratio():
    """
    Returns a win ratio based on probability distribution:
    - 25% chance: 0% (complete loss - curse of the pharaoh)
    - 20% chance: 10-40% (dangerous expedition)
    - 40% chance: 41-80% (successful expedition)
    - 10% chance: 81-150% (lucrative discovery)
    - 3% chance: 151-250% (ancient treasure)
    - 2% chance: 251-400% (pharaoh's blessing)
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 25:  # 25% chance: Complete loss (0%)
        return Decimal("0.00")
    elif rand <= 45:  # 20% chance: Dangerous (10-40%)
        return Decimal(str(random.uniform(0.10, 0.40)))
    elif rand <= 85:  # 40% chance: Successful (41-80%)
        return Decimal(str(random.uniform(0.41, 0.80)))
    elif rand <= 95:  # 10% chance: Lucrative (81-150%)
        return Decimal(str(random.uniform(0.81, 1.50)))
    elif rand <= 98:  # 3% chance: Ancient treasure (151-250%)
        return Decimal(str(random.uniform(1.51, 2.50)))
    else:  # 2% chance: Pharaoh's blessing (251-400%)
        return Decimal(str(random.uniform(2.51, 4.00)))


def calculate_artifact_bonus(artifacts_found):
    """Calculate bonus based on artifact rarity and quantity"""
    total_bonus = Decimal("0.0")
    legendary_count = 0
    rarity_bonuses = {
        'common': Decimal("0.02"),
        'uncommon': Decimal("0.05"),
        'rare': Decimal("0.10"),
        'epic': Decimal("0.15"),
        'legendary': Decimal("0.25"),
        'mythic': Decimal("0.50"),
    }
    
    for artifact in artifacts_found:
        rarity = artifact.get('rarity', 'common')
        if rarity in rarity_bonuses:
            total_bonus += rarity_bonuses[rarity]
            if rarity in ['legendary', 'mythic']:
                legendary_count += 1
    
    # Quantity bonus
    quantity_bonus = len(artifacts_found) * Decimal("0.03")
    total_bonus += quantity_bonus
    
    return total_bonus, legendary_count


def calculate_survival_penalty(traps_encountered, chambers_count):
    """Calculate penalty based on traps encountered"""
    if chambers_count == 0:
        return Decimal("1.0")
    
    trap_ratio = traps_encountered / chambers_count
    if trap_ratio <= 0.25:
        return Decimal("1.0")  # No penalty
    elif trap_ratio <= 0.5:
        return Decimal("0.8")  # 20% penalty
    elif trap_ratio <= 0.75:
        return Decimal("0.6")  # 40% penalty
    else:
        return Decimal("0.4")  # 60% penalty


def get_expedition_rank(win_ratio, artifacts_found, traps_encountered):
    """Determine expedition rank based on results"""
    if win_ratio == 0:
        return "cursed"
    elif win_ratio <= 0.40:
        return "dangerous"
    elif win_ratio <= 0.80:
        return "successful"
    elif win_ratio <= 1.50:
        return "lucrative"
    elif win_ratio <= 2.50:
        return "legendary"
    else:
        return "blessed"


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

        if wallet.spot_balance >= remaining_cost:
            wallet.spot_balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.spot_balance
            wallet.spot_balance = Decimal("0.00")
            wallet.balance -= remaining_cost

        # ================= EXPEDITION LOGIC =================
        is_curse = random.random() < LOSS_PROBABILITY

        chambers_explored = []
        artifacts_found = []
        traps_encountered = 0
        
        # Explore 3-6 chambers
        chambers_count = random.randint(3, 6)
        
        for _ in range(chambers_count):
            chamber = random.choice(PYRAMID_CHAMBERS)
            chambers_explored.append(chamber)

            if random.random() < chamber["danger"]:
                traps_encountered += 1

            if random.random() < chamber["treasure_chance"]:
                artifact = random.choice(ARTIFACTS)
                artifacts_found.append(artifact)

        if is_curse:
            win_ratio = Decimal("0.00")
            win_amount = Decimal("0.00")
            survival_rate = Decimal("0.00")
            artifact_bonus = Decimal("0.00")
            legendary_count = 0
            expedition_rank = "cursed"
        else:
            # Get base win ratio
            win_ratio = get_pyramid_win_ratio()
            
            # Calculate artifact bonuses
            artifact_bonus, legendary_count = calculate_artifact_bonus(artifacts_found)
            
            # Calculate survival penalty
            survival_rate = Decimal("1.0") - (Decimal(str(traps_encountered)) / Decimal(str(chambers_count)))
            survival_penalty = calculate_survival_penalty(traps_encountered, chambers_count)
            
            # Apply bonuses and penalties
            total_multiplier = win_ratio * (1 + artifact_bonus) * survival_penalty
            
            # Calculate win amount
            win_amount = (bet_amount * total_multiplier).quantize(Decimal("0.01"))
            
            # Determine expedition rank
            expedition_rank = get_expedition_rank(float(total_multiplier), artifacts_found, traps_encountered)

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
            win_ratio=float(win_ratio + artifact_bonus) if not is_curse else 0.0,
            survival_rate=float(survival_rate) if not is_curse else 0.0,
        )

        stats, _ = PyramidStats.objects.get_or_create(user=user)
        stats.total_expeditions += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        stats.traps_survived += chambers_count - traps_encountered
        stats.total_artifacts += len(artifacts_found)
        stats.chambers_explored_total += chambers_count
        
        # Track highest win ratio
        total_win_ratio = win_ratio + artifact_bonus if not is_curse else Decimal("0.0")
        if total_win_ratio > stats.highest_win_ratio:
            stats.highest_win_ratio = float(total_win_ratio)
            
        # Track highest survival rate
        if survival_rate > stats.highest_survival_rate:
            stats.highest_survival_rate = float(survival_rate)
            
        # Track highest multiplier
        if not is_curse:
            final_multiplier = win_amount / bet_amount if bet_amount > 0 else Decimal("0.0")
            if final_multiplier > stats.highest_multiplier:
                stats.highest_multiplier = final_multiplier
        
        stats.save()

        # Determine win tier for frontend
        win_tier = "loss"
        if total_win_ratio > 0:
            if total_win_ratio <= 0.40:
                win_tier = "dangerous"
            elif total_win_ratio <= 0.80:
                win_tier = "successful"
            elif total_win_ratio <= 1.50:
                win_tier = "lucrative"
            elif total_win_ratio <= 2.50:
                win_tier = "legendary"
            else:
                win_tier = "blessed"

        return Response({
            "chambers_explored": chambers_explored,
            "chambers_count": chambers_count,
            "traps_encountered": traps_encountered,
            "artifacts_found": artifacts_found,
            "artifact_count": len(artifacts_found),
            "legendary_count": legendary_count,
            "artifact_bonus": float(artifact_bonus) if not is_curse else 0.0,
            "survival_rate": float(survival_rate) if not is_curse else 0.0,
            "expedition_rank": expedition_rank,
            "win_tier": win_tier,
            "final_multiplier": float(win_amount / bet_amount) if bet_amount > 0 and not is_curse else 0.0,
            "win_amount": float(win_amount),
            "win_ratio": float(total_win_ratio) if not is_curse else 0.0,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "expedition_id": exploration.id,
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
        dangerous = expeditions.filter(win_ratio__gt=0, win_ratio__lte=0.4).count()
        successful = expeditions.filter(win_ratio__gt=0.4, win_ratio__lte=0.8).count()
        lucrative = expeditions.filter(win_ratio__gt=0.8, win_ratio__lte=1.5).count()
        legendary = expeditions.filter(win_ratio__gt=1.5, win_ratio__lte=2.5).count()
        blessed = expeditions.filter(win_ratio__gt=2.5).count()
        
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
            'highest_win_ratio': round(float(stats.highest_win_ratio), 2),
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
                'legendary': legendary,
                'blessed': blessed
            },
            'explorer_rank': calculate_explorer_rank(total_expeditions, total_artifacts, stats.highest_win_ratio)
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
            
            # Determine expedition rank
            win_tier = "cursed"
            if exploration.win_ratio > 0:
                if exploration.win_ratio <= 0.40:
                    win_tier = "dangerous"
                elif exploration.win_ratio <= 0.80:
                    win_tier = "successful"
                elif exploration.win_ratio <= 1.50:
                    win_tier = "lucrative"
                elif exploration.win_ratio <= 2.50:
                    win_tier = "legendary"
                else:
                    win_tier = "blessed"

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
                'survival_rate': float(exploration.survival_rate) * 100,
                'final_multiplier': float(exploration.win_amount / exploration.bet_amount) if exploration.bet_amount > 0 else 0,
                'created_at': exploration.created_at.isoformat(),
                'was_successful': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def calculate_explorer_rank(total_expeditions, total_artifacts, highest_win_ratio):
    """
    Calculate explorer rank based on total expeditions and artifacts found
    """
    if total_expeditions >= 50 and total_artifacts >= 30 and highest_win_ratio >= 3.0:
        return "Pharaoh's Chosen ✨"
    elif total_expeditions >= 30 and total_artifacts >= 20 and highest_win_ratio >= 2.0:
        return "Master Archaeologist 🏺"
    elif total_expeditions >= 20 and total_artifacts >= 10:
        return "Elite Explorer ⚱️"
    elif total_expeditions >= 10 and total_artifacts >= 5:
        return "Seasoned Adventurer 🗿"
    elif total_expeditions >= 5:
        return "Amateur Historian 🔍"
    else:
        return "Novice Explorer 🧭"