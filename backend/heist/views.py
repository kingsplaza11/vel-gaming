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

# Updated probability constants
ABOVE_1_5X_CHANCE = 0.45  # 45% chance to win above 1.5x
BELOW_1_5X_CHANCE = 0.10  # 10% chance to win below 1.5x
LOSS_CHANCE = 0.45  # 45% chance to lose (total 55% lose/below 1.5x)

BANKS = [
    {'name': 'Quantum Bank', 'security': 3, 'base_multiplier': 0.09, 'image': '🔒', 'difficulty': 'easy'},
    {'name': 'Neo Financial', 'security': 5, 'base_multiplier': 0.12, 'image': '💳', 'difficulty': 'medium'},
    {'name': 'Cyber Trust', 'security': 7, 'base_multiplier': 0.25, 'image': '🖥️', 'difficulty': 'hard'},
    {'name': 'Digital Vault', 'security': 9, 'base_multiplier': 0.20, 'image': '🏦', 'difficulty': 'expert'},
]

HACKS = [
    {'name': 'Phishing Attack', 'success_rate': 0.8, 'image': '🎣', 'difficulty_penalty': 0.1},
    {'name': 'Brute Force', 'success_rate': 0.6, 'image': '🔨', 'difficulty_penalty': 0.15},
    {'name': 'SQL Injection', 'success_rate': 0.7, 'image': '💉', 'difficulty_penalty': 0.12},
    {'name': 'Zero Day Exploit', 'success_rate': 0.9, 'image': '🕵️', 'difficulty_penalty': 0.05},
    {'name': 'Social Engineering', 'success_rate': 0.85, 'image': '🎭', 'difficulty_penalty': 0.08},
    {'name': 'Man-in-the-Middle', 'success_rate': 0.75, 'image': '👥', 'difficulty_penalty': 0.13},
    {'name': 'DDoS Attack', 'success_rate': 0.65, 'image': '🌪️', 'difficulty_penalty': 0.17},
    {'name': 'Malware Payload', 'success_rate': 0.8, 'image': '🦠', 'difficulty_penalty': 0.07},
]

FAILED_HACKS = [
    {'name': 'Firewall Detected', 'effect': -0.5, 'image': '🔥', 'type': 'detection'},
    {'name': 'Trace Back', 'effect': -0.7, 'image': '🕵️‍♂️', 'type': 'trace'},
    {'name': 'System Crash', 'effect': -0.9, 'image': '💥', 'type': 'crash'},
    {'name': 'AI Counterattack', 'effect': -1.0, 'image': '🤖', 'type': 'counter'},
    {'name': 'Network Lockdown', 'effect': -1.2, 'image': '🔒', 'type': 'lockdown'},
]


# ================= WIN MULTIPLIER LOGIC =================
def get_heist_multiplier(win_type):
    """
    Returns a win multiplier based on win type:
    - 'above_1_5x': 45% chance, multipliers from 1.6x to 4.0x
    - 'below_1_5x': 10% chance, multipliers from 0.5x to 1.49x
    """
    if win_type == 'above_1_5x':
        # 45% chance - good wins above 1.5x
        rand = random.random()
        if rand < 0.50:  # 50% of above-1.5x wins: 1.6x - 2.5x
            return random.uniform(0.06, 0.15)
        elif rand < 0.80:  # 30% of above-1.5x wins: 2.6x - 3.0x
            return random.uniform(0.16, 0.20)
        elif rand < 0.95:  # 15% of above-1.5x wins: 3.1x - 3.5x
            return random.uniform(0.21, 0.25)
        else:  # 5% of above-1.5x wins: 3.6x - 4.0x
            return random.uniform(0.26, 0.30)
    
    else:  # 'below_1_5x'
        # 10% chance - small wins below 1.5x
        return random.uniform(0.5, 0.39)


def calculate_hack_success(hacks_used, target_security, bank_difficulty):
    """Calculate hack success and multiplier effects"""
    successful_hacks = []
    failed_hacks = []
    hack_multiplier = Decimal("0.0")
    
    difficulty_penalties = {
        'easy': 1.0,
        'medium': 0.9,
        'hard': 0.8,
        'expert': 0.7
    }
    
    penalty = difficulty_penalties.get(bank_difficulty, 1.0)
    
    for hack in hacks_used:
        # Adjusted success chance based on bank security and difficulty
        base_success = hack['success_rate']
        adjusted_success = base_success * (5 / target_security) * penalty
        
        if random.random() < adjusted_success:
            successful_hacks.append(hack)
            # Successful hack adds to multiplier
            hack_multiplier += Decimal("0.15")  # 15% per successful hack
        else:
            failed_hack = random.choice(FAILED_HACKS)
            failed_hacks.append(failed_hack)
            # Failed hack reduces multiplier
            hack_multiplier += Decimal(str(failed_hack['effect']))
    
    # Calculate average hack multiplier
    total_hacks = len(successful_hacks) + len(failed_hacks)
    avg_hack_mult = hack_multiplier / total_hacks if total_hacks > 0 else Decimal("0.0")
    
    # Cap hack multiplier within reasonable bounds (-0.5 to 1.0)
    final_hack_mult = max(Decimal("-0.5"), min(Decimal("1.0"), avg_hack_mult))
    
    return successful_hacks, failed_hacks, final_hack_mult


def get_heist_tier(multiplier):
    """Determine heist tier based on multiplier"""
    if multiplier <= 0:
        return "failed"
    elif multiplier < 1.5:
        return "small"
    elif multiplier <= 2.5:
        return "medium"
    elif multiplier <= 3.5:
        return "large"
    else:
        return "epic"


def select_hacks():
    """
    Select 3 random hacks
    - More challenging to win with new probabilities
    """
    # Weighted selection: higher success hacks more likely
    hacks = []
    weighted_hacks = []
    weights = []
    
    for hack in HACKS:
        weighted_hacks.append(hack)
        weights.append(hack['success_rate'] * 10)  # Scale success rates for weights
    
    # Select 3 hacks without replacement
    selected_indices = random.choices(range(len(weighted_hacks)), weights=weights, k=3)
    hacks = [weighted_hacks[i] for i in selected_indices]
    
    return hacks, False  # Not failed scenario


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

        if wallet.balance >= remaining_cost:
            wallet.balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.balance
            wallet.balance = Decimal("0.00")
            wallet.spot_balance -= remaining_cost

        # ================= HEIST LOGIC =================
        # First determine win type
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

        # Select hacks
        hacks_used, is_failed_scenario = select_hacks()
        
        if is_loss:
            # Immediate loss
            win_multiplier = Decimal("0.00")
            win_amount = Decimal("0.00")
            successful_hacks = []
            failed_hacks = []
            hack_multiplier = Decimal("0.00")
            base_multiplier = Decimal("0.00")
            heist_tier = "failed"
        else:
            # Calculate hack success and effects
            successful_hacks, failed_hacks, hack_multiplier = calculate_hack_success(
                hacks_used, target['security'], target['difficulty']
            )
            
            # Get base multiplier based on win type
            base_multiplier = Decimal(str(get_heist_multiplier(win_type)))
            
            # For above 1.5x wins, ensure multiplier stays above 1.5x
            if win_type == 'above_1_5x':
                base_multiplier = max(Decimal("0.25"), base_multiplier)
            
            # Calculate final multiplier (blend: 70% base, 30% hacks)
            blended_multiplier = (base_multiplier * Decimal("0.7")) + (hack_multiplier * Decimal("0.3"))
            
            # Apply bank multiplier
            final_multiplier = blended_multiplier * Decimal(str(target['base_multiplier']))
            
            # Cap multipliers based on win type
            if win_type == 'above_1_5x':
                final_multiplier = max(Decimal("0.25"), min(Decimal("5.0"), final_multiplier))
            else:  # below_1_5x
                final_multiplier = min(Decimal("1.49"), final_multiplier)
            
            # Check escape success (based on hack performance)
            escape_success_rate = len(successful_hacks) / len(hacks_used) if hacks_used else 0
            escape_success = random.random() < (0.4 + escape_success_rate * 0.6)  # 40-100% chance
            
            if not escape_success:
                # Escape failed - heist compromised
                win_multiplier = Decimal("0.00")
                win_amount = Decimal("0.00")
                heist_tier = "failed"
            else:
                # Successful heist
                win_multiplier = final_multiplier
                win_amount = (bet_amount * final_multiplier).quantize(Decimal("0.01"))
                heist_tier = get_heist_tier(float(final_multiplier))

        # =====================
        # CREDIT WIN → SPOT BALANCE
        # =====================
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["balance", "spot_balance"])

        # Prepare hack results
        hack_results = {
            'used': hacks_used,
            'successful': successful_hacks,
            'failed': failed_hacks,
            'count': len(hacks_used),
            'success_count': len(successful_hacks),
            'failed_count': len(failed_hacks),
            'was_failed_scenario': is_loss  # Use is_loss instead of separate scenario flag
        }

        heist = CyberHeist.objects.create(
            user=user,
            bet_amount=bet_amount,
            target_bank=target["name"],
            security_level=target["security"],
            hacks_used=hacks_used,
            escape_success=win_amount > 0,
            win_amount=win_amount,
            win_ratio=float(win_multiplier),
        )

        stats, _ = HeistStats.objects.get_or_create(user=user)
        stats.total_heists += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        stats.total_hacks_attempted += len(hacks_used)
        
        if win_amount > 0:
            stats.successful_heists += 1
            
            # Track heist tiers
            if heist_tier == "small":
                stats.small_heists += 1
            elif heist_tier == "medium":
                stats.medium_heists += 1
            elif heist_tier == "large":
                stats.large_heists += 1
            elif heist_tier == "epic":
                stats.epic_heists += 1
        
        if win_amount > stats.highest_heist:
            stats.highest_heist = win_amount
            
        # Track highest win ratio
        if win_multiplier > stats.highest_win_ratio:
            stats.highest_win_ratio = float(win_multiplier)
            
        # Update favorite bank (most attempted)
        bank_counts = CyberHeist.objects.filter(user=user).values('target_bank').annotate(count=Count('id'))
        if bank_counts:
            favorite = max(bank_counts, key=lambda x: x['count'])
            stats.favorite_bank = favorite['target_bank']
            
        stats.save()

        # Determine win tier for frontend
        win_tier = "failed"
        if not is_loss:
            if win_type == 'below_1_5x':
                win_tier = "small"
            else:
                win_tier = heist_tier

        return Response({
            "target_bank": target,
            "hacks_used": hacks_used,
            "hack_results": hack_results,
            "escape_success": win_amount > 0,
            "successful_hacks": len(successful_hacks),
            "failed_hacks": len(failed_hacks),
            "win_amount": float(win_amount),
            "win_multiplier": float(win_multiplier) if win_amount > 0 else 0.0,
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
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'highest_heist': round(float(stats.highest_heist), 2),
            'highest_multiplier': round(stats.highest_win_ratio, 2),
            'favorite_bank': stats.favorite_bank,
            'avg_hacks_per_heist': round(avg_hacks, 2),
            'hacker_rank': hacker_rank,
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
            if heist.win_ratio > 0:
                if heist.win_ratio < 1.5:
                    win_tier = "small"
                elif heist.win_ratio <= 2.5:
                    win_tier = "medium"
                elif heist.win_ratio <= 3.5:
                    win_tier = "large"
                else:
                    win_tier = "epic"

            history.append({
                'id': heist.id,
                'target_bank': heist.target_bank,
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


def calculate_hacker_rank(total_heists, successful_heists, highest_heist, highest_multiplier):
    """
    Calculate hacker rank based on performance
    """
    if total_heists >= 50 and successful_heists >= 35 and highest_multiplier >= 3.5:
        return "Shadow Ghost 🔥"
    elif total_heists >= 30 and successful_heists >= 21 and highest_multiplier >= 3.0:
        return "Cyber Overlord ⚡"
    elif total_heists >= 20 and successful_heists >= 14 and highest_multiplier >= 2.5:
        return "Master Hacker 💻"
    elif total_heists >= 15 and successful_heists >= 10:
        return "Digital Ninja 🥷"
    elif total_heists >= 10 and successful_heists >= 7:
        return "Script Kiddie 👾"
    elif total_heists >= 5:
        return "Novice Hacker 🎯"
    else:
        return "New Recruit 🆕"


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_game_info(request):
    """
    Get cyber heist game information
    """
    return Response({
        'game_info': {
            'name': 'Cyber Heist',
            'description': 'Hack into digital banks using various cyber attacks!',
            'minimum_bet': '100.00',
        },
        'banks': BANKS,
        'hacks': HACKS,
    })