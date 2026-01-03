import random
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Sum, Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import CyberHeist, HeistStats
from wallets.models import Wallet
from accounts.models import User

MIN_STAKE = Decimal("100")

BANKS = [
    {'name': 'Quantum Bank', 'security': 3, 'base_multiplier': 1.5, 'image': '🔒', 'difficulty': 'easy'},
    {'name': 'Neo Financial', 'security': 5, 'base_multiplier': 1.8, 'image': '💳', 'difficulty': 'medium'},
    {'name': 'Cyber Trust', 'security': 7, 'base_multiplier': 2.2, 'image': '🖥️', 'difficulty': 'hard'},
    {'name': 'Digital Vault', 'security': 9, 'base_multiplier': 3.0, 'image': '🏦', 'difficulty': 'expert'},
]

HACKS = [
    {'name': 'Phishing Attack', 'success_rate': 0.7, 'image': '🎣', 'difficulty_penalty': 0.1},
    {'name': 'Brute Force', 'success_rate': 0.5, 'image': '🔨', 'difficulty_penalty': 0.15},
    {'name': 'SQL Injection', 'success_rate': 0.6, 'image': '💉', 'difficulty_penalty': 0.12},
    {'name': 'Zero Day Exploit', 'success_rate': 0.9, 'image': '🕵️', 'difficulty_penalty': 0.05},
    {'name': 'Social Engineering', 'success_rate': 0.75, 'image': '🎭', 'difficulty_penalty': 0.08},
    {'name': 'Man-in-the-Middle', 'success_rate': 0.65, 'image': '👥', 'difficulty_penalty': 0.13},
    {'name': 'DDoS Attack', 'success_rate': 0.55, 'image': '🌪️', 'difficulty_penalty': 0.17},
    {'name': 'Malware Payload', 'success_rate': 0.8, 'image': '🦠', 'difficulty_penalty': 0.07},
]

# ================= WIN RATIO LOGIC =================
def get_heist_win_ratio(bank_difficulty):
    """
    Returns a win ratio based on probability distribution with bank difficulty adjustments:
    - 25% chance: 10-30% (small heist)
    - 50% chance: 31-40% (medium heist)
    - 15% chance: 41-100% (large heist)
    - 6% chance: 101-200% (epic heist)
    - 3% chance: 201-300% (legendary heist)
    - 1% chance: 301-400% (ultimate heist)
    
    Higher difficulty banks increase chances of better ratios but also increase risk
    """
    rand = random.random() * 100  # 0-100
    
    # Base probabilities
    if rand <= 25:  # 25% chance: Small heist (10-30%)
        base_ratio = random.uniform(0.10, 0.30)
    elif rand <= 75:  # 50% chance: Medium heist (31-40%)
        base_ratio = random.uniform(0.31, 0.40)
    elif rand <= 90:  # 15% chance: Large heist (41-100%)
        base_ratio = random.uniform(0.41, 1.00)
    elif rand <= 96:  # 6% chance: Epic heist (101-200%)
        base_ratio = random.uniform(1.01, 2.00)
    elif rand <= 99:  # 3% chance: Legendary heist (201-300%)
        base_ratio = random.uniform(2.01, 3.00)
    else:  # 1% chance: Ultimate heist (301-400%)
        base_ratio = random.uniform(3.01, 4.00)
    
    # Apply bank difficulty multiplier
    difficulty_multipliers = {
        'easy': 1.0,
        'medium': 1.2,
        'hard': 1.5,
        'expert': 2.0
    }
    
    multiplier = difficulty_multipliers.get(bank_difficulty, 1.0)
    adjusted_ratio = base_ratio * multiplier
    
    # Cap at 500% for safety
    return min(adjusted_ratio, 5.0)


def calculate_hack_bonus(hacks_used, target_security):
    """Calculate bonus based on hack success and synergy"""
    total_bonus = Decimal("0.0")
    successful_hacks = 0
    hack_combo_bonus = Decimal("0.0")
    
    # Check for hack synergies
    hack_names = [hack['name'] for hack in hacks_used]
    
    # Count successful hacks
    for hack in hacks_used:
        success_chance = hack['success_rate'] * (5 / target_security)
        if random.random() < success_chance:
            successful_hacks += 1
            total_bonus += Decimal("0.05")  # 5% per successful hack
    
    # Combo bonuses
    if successful_hacks >= 2:
        hack_combo_bonus = Decimal("0.10")  # 10% for 2+ successful hacks
    if successful_hacks >= 3:
        hack_combo_bonus = Decimal("0.25")  # 25% for 3+ successful hacks
    
    # Special combo: Zero Day + Social Engineering
    if 'Zero Day Exploit' in hack_names and 'Social Engineering' in hack_names:
        hack_combo_bonus += Decimal("0.15")
    
    total_bonus += hack_combo_bonus
    
    return total_bonus, successful_hacks


def get_heist_tier(win_ratio):
    """Determine heist tier based on win ratio"""
    if win_ratio == 0:
        return "failed"
    elif win_ratio <= 0.30:
        return "small"
    elif win_ratio <= 0.40:
        return "medium"
    elif win_ratio <= 1.00:
        return "large"
    elif win_ratio <= 2.00:
        return "epic"
    elif win_ratio <= 3.00:
        return "legendary"
    else:
        return "ultimate"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_heist(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount")))
        target_name = request.data.get("target_bank")
    except (InvalidOperation, TypeError):
        return Response({"error": "Invalid parameters"}, status=400)

    if bet_amount < MIN_STAKE:
        return Response({"error": f"Minimum stake is ₦{MIN_STAKE}"}, status=400)

    target = next((b for b in BANKS if b["name"] == target_name), None)
    if not target:
        return Response({"error": "Invalid target"}, status=400)

    with transaction.atomic():
        user = User.objects.select_for_update().get(id=request.user.id)
        wallet = Wallet.objects.select_for_update().get(user=user)

        # Check combined balance (wallet + spot_balance)
        combined_balance = wallet.balance + wallet.spot_balance
        if combined_balance < bet_amount:
            return Response({"error": "Insufficient balance (wallet + spot)"}, status=400)

        # =====================
        # DEDUCT STAKE (wallet → spot)
        # =====================
        remaining_cost = bet_amount
        taken_from_wallet = Decimal('0')
        taken_from_spot = Decimal('0')

        # 1️⃣ Deduct from wallet balance first
        if wallet.balance > 0:
            taken_from_wallet = min(wallet.balance, remaining_cost)
            wallet.balance -= taken_from_wallet
            remaining_cost -= taken_from_wallet

        # 2️⃣ If still remaining, deduct from spot balance
        if remaining_cost > 0 and wallet.spot_balance > 0:
            taken_from_spot = min(wallet.spot_balance, remaining_cost)
            wallet.spot_balance -= taken_from_spot
            remaining_cost -= taken_from_spot

        wallet.save(update_fields=["balance", "spot_balance"])

        # 3️⃣ Optional: Check if we covered the full amount
        # (This should already be validated before reaching this point)

        # ================= HEIST LOGIC =================
        # Select 3 random hacks
        hacks_used = random.sample(HACKS, k=3)
        
        # Determine if heist is detected (escape failure)
        escape_success = random.random() < 0.65  # 65% chance of successful escape
        
        if not escape_success:
            win_ratio = Decimal("0.00")
            win_amount = Decimal("0.00")
            successful_hacks = 0
            hack_bonus = Decimal("0.00")
        else:
            # Get base win ratio
            win_ratio = Decimal(str(get_heist_win_ratio(target['difficulty'])))
            
            # Calculate hack bonuses
            hack_bonus, successful_hacks = calculate_hack_bonus(hacks_used, target['security'])
            
            # Apply hack bonus to win ratio
            win_ratio_with_bonus = win_ratio * (1 + hack_bonus)
            
            # Apply bank multiplier
            win_ratio_with_bank = win_ratio_with_bonus * Decimal(str(target['base_multiplier']))
            
            # Cap win ratio at 500% (5x) for safety
            final_win_ratio = min(win_ratio_with_bank, Decimal("5.00"))
            
            # Calculate win amount
            win_amount = (bet_amount * final_win_ratio).quantize(Decimal("0.01"))

        # =====================
        # CREDIT WIN → SPOT BALANCE
        # =====================
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["balance", "spot_balance"])

        heist = CyberHeist.objects.create(
            user=user,
            bet_amount=bet_amount,
            target_bank=target["name"],
            security_level=target["security"],
            hacks_used=hacks_used,
            escape_success=escape_success,
            win_amount=win_amount,
            win_ratio=float(win_ratio * Decimal(str(target['base_multiplier'])) + hack_bonus),  # Store total win ratio
        )

        stats, _ = HeistStats.objects.get_or_create(user=user)
        stats.total_heists += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        stats.total_hacks_attempted += len(hacks_used)
        
        if escape_success:
            stats.successful_heists += 1
            
            # Track heist tiers
            heist_tier = get_heist_tier(float(win_ratio * Decimal(str(target['base_multiplier'])) + hack_bonus))
            if heist_tier == "small":
                stats.small_heists += 1
            elif heist_tier == "medium":
                stats.medium_heists += 1
            elif heist_tier == "large":
                stats.large_heists += 1
            elif heist_tier == "epic":
                stats.epic_heists += 1
            elif heist_tier == "legendary":
                stats.legendary_heists += 1
        
        if win_amount > stats.highest_heist:
            stats.highest_heist = win_amount
            
        # Track highest win ratio
        total_win_ratio = win_ratio * Decimal(str(target['base_multiplier'])) + hack_bonus
        if total_win_ratio > stats.highest_win_ratio:
            stats.highest_win_ratio = float(total_win_ratio)
            
        # Update favorite bank (most attempted)
        bank_counts = CyberHeist.objects.filter(user=user).values('target_bank').annotate(count=Count('id'))
        if bank_counts:
            favorite = max(bank_counts, key=lambda x: x['count'])
            stats.favorite_bank = favorite['target_bank']
            
        stats.save()

        # Determine win tier for frontend
        win_tier = "failed"
        if escape_success:
            heist_tier = get_heist_tier(float(total_win_ratio))
            win_tier = heist_tier

        return Response({
            "target_bank": target,
            "hacks_used": hacks_used,
            "escape_success": escape_success,
            "successful_hacks": successful_hacks,
            "hack_bonus": float(hack_bonus),
            "win_amount": float(win_amount),
            "win_ratio": float(total_win_ratio),
            "win_tier": win_tier,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "heist_id": heist.id,
        })


# ================= STATS ENDPOINTS =================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_heist_stats(request):
    """Get comprehensive heist statistics"""
    try:
        stats, _ = HeistStats.objects.get_or_create(user=request.user)
        
        total_heists = stats.total_heists
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        
        # Calculate success rates
        success_rate = (stats.successful_heists / total_heists * 100) if total_heists > 0 else 0
        
        # Calculate heist tier distribution
        small_rate = (stats.small_heists / total_heists * 100) if total_heists > 0 else 0
        medium_rate = (stats.medium_heists / total_heists * 100) if total_heists > 0 else 0
        large_rate = (stats.large_heists / total_heists * 100) if total_heists > 0 else 0
        epic_rate = (stats.epic_heists / total_heists * 100) if total_heists > 0 else 0
        legendary_rate = (stats.legendary_heists / total_heists * 100) if total_heists > 0 else 0
        
        # Calculate profit and ROI
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        
        # Calculate average hacks per heist
        avg_hacks = (stats.total_hacks_attempted / total_heists) if total_heists > 0 else 0
        
        # Calculate hacker rank
        hacker_rank = calculate_hacker_rank(
            total_heists, stats.successful_heists, 
            float(stats.highest_heist), stats.highest_win_ratio
        )
        
        return Response({
            'total_heists': total_heists,
            'successful_heists': stats.successful_heists,
            'success_rate': round(success_rate, 2),
            'small_heists': stats.small_heists,
            'medium_heists': stats.medium_heists,
            'large_heists': stats.large_heists,
            'epic_heists': stats.epic_heists,
            'legendary_heists': stats.legendary_heists,
            'small_rate': round(small_rate, 2),
            'medium_rate': round(medium_rate, 2),
            'large_rate': round(large_rate, 2),
            'epic_rate': round(epic_rate, 2),
            'legendary_rate': round(legendary_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'highest_heist': round(float(stats.highest_heist), 2),
            'highest_win_ratio': round(stats.highest_win_ratio, 2),
            'favorite_bank': stats.favorite_bank,
            'total_hacks_attempted': stats.total_hacks_attempted,
            'avg_hacks_per_heist': round(avg_hacks, 2),
            'hacker_rank': hacker_rank
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_heist_history(request):
    """Get recent heist history"""
    try:
        heists = CyberHeist.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for heist in heists:
            profit = heist.win_amount - heist.bet_amount
            
            # Determine win tier
            win_tier = "failed"
            if heist.escape_success:
                if heist.win_ratio <= 0.30:
                    win_tier = "small"
                elif heist.win_ratio <= 0.40:
                    win_tier = "medium"
                elif heist.win_ratio <= 1.00:
                    win_tier = "large"
                elif heist.win_ratio <= 2.00:
                    win_tier = "epic"
                elif heist.win_ratio <= 3.00:
                    win_tier = "legendary"
                else:
                    win_tier = "ultimate"

            history.append({
                'id': heist.id,
                'target_bank': heist.target_bank,
                'security_level': heist.security_level,
                'bet_amount': float(heist.bet_amount),
                'win_amount': float(heist.win_amount),
                'win_ratio': float(heist.win_ratio),
                'win_tier': win_tier,
                'profit': float(profit),
                'hacks_used': heist.hacks_used,
                'escape_success': heist.escape_success,
                'created_at': heist.created_at.isoformat(),
                'was_profitable': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def calculate_hacker_rank(total_heists, successful_heists, highest_heist, highest_win_ratio):
    """
    Calculate hacker rank based on performance
    """
    if total_heists >= 50 and successful_heists >= 30 and highest_win_ratio >= 4.0:
        return "Shadow Ghost 🔥"
    elif total_heists >= 30 and successful_heists >= 20 and highest_win_ratio >= 3.0:
        return "Cyber Overlord ⚡"
    elif total_heists >= 20 and successful_heists >= 15 and highest_heist >= 50000:
        return "Master Hacker 💻"
    elif total_heists >= 15 and successful_heists >= 10:
        return "Digital Ninja 🥷"
    elif total_heists >= 10 and successful_heists >= 5:
        return "Script Kiddie 👾"
    elif total_heists >= 5:
        return "Novice Hacker 🎯"
    else:
        return "New Recruit 🆕"