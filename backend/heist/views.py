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
    {'name': 'Quantum Bank', 'security': 3, 'base_multiplier': 1.0, 'image': '🔒', 'difficulty': 'easy'},
    {'name': 'Neo Financial', 'security': 5, 'base_multiplier': 1.2, 'image': '💳', 'difficulty': 'medium'},
    {'name': 'Cyber Trust', 'security': 7, 'base_multiplier': 1.5, 'image': '🖥️', 'difficulty': 'hard'},
    {'name': 'Digital Vault', 'security': 9, 'base_multiplier': 2.0, 'image': '🏦', 'difficulty': 'expert'},
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
def get_heist_multiplier():
    """
    Returns a win multiplier between 0.5x and 3.5x based on weighted distribution:
    - 40% chance: 0.5x - 1.5x (small heist)
    - 40% chance: 1.6x - 2.5x (medium heist)
    - 15% chance: 2.6x - 3.0x (large heist)
    - 5% chance: 3.1x - 3.5x (epic heist)
    """
    rand = random.random() * 100  # 0-100
    
    if rand <= 40:  # 40% chance: Small heist (0.5x - 1.5x)
        return random.uniform(0.5, 1.5)
    elif rand <= 80:  # 40% chance: Medium heist (1.6x - 2.5x)
        return random.uniform(1.6, 2.5)
    elif rand <= 95:  # 15% chance: Large heist (2.6x - 3.0x)
        return random.uniform(2.6, 3.0)
    else:  # 5% chance: Epic heist (3.1x - 3.5x)
        return random.uniform(3.1, 3.5)


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
            hack_multiplier += Decimal("0.1")  # 10% per successful hack
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
    elif multiplier <= 1.5:
        return "small"
    elif multiplier <= 2.5:
        return "medium"
    elif multiplier <= 3.0:
        return "large"
    else:
        return "epic"


def select_hacks():
    """
    Select 3 random hacks with a chance for failure
    70% chance: Normal hack selection
    30% chance: Mixed with failed hacks
    """
    roll = random.random()
    
    if roll < 0.70:  # 70% chance: Normal hacks
        # Weighted selection: higher success hacks more likely
        hacks = []
        for _ in range(3):
            weighted_hacks = []
            weights = []
            for hack in HACKS:
                weighted_hacks.append(hack)
                weights.append(hack['success_rate'] * 10)  # Scale success rates for weights
            
            hack = random.choices(weighted_hacks, weights=weights, k=1)[0]
            hacks.append(hack)
        return hacks, False  # Not failed
        
    else:  # 30% chance: Mixed with failed hacks scenario
        # Start with 1-2 normal hacks
        num_normal = random.randint(1, 2)
        hacks = random.sample(HACKS, num_normal)
        
        # Add failed hacks (treated as negative effect hacks)
        num_failed = 3 - num_normal
        for _ in range(num_failed):
            failed_hack = random.choice(FAILED_HACKS)
            # Convert failed hack to a hack-like structure for consistency
            hack_struct = {
                'name': failed_hack['name'],
                'success_rate': 0.0,  # Will always fail
                'image': failed_hack['image'],
                'difficulty_penalty': 0.0
            }
            hacks.append(hack_struct)
        
        return hacks, True  # Failed scenario


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
        # Select hacks (70% normal, 30% failed scenario)
        hacks_used, is_failed_scenario = select_hacks()
        
        if is_failed_scenario:
            # Failed heist scenario - immediate loss
            win_multiplier = Decimal("0.00")
            win_amount = Decimal("0.00")
            successful_hacks = []
            failed_hacks = hacks_used
            hack_multiplier = Decimal("0.00")
            base_multiplier = Decimal("0.00")
            heist_tier = "failed"
        else:
            # Normal heist scenario
            # Get base multiplier
            base_multiplier = Decimal(str(get_heist_multiplier()))
            
            # Calculate hack success and effects
            successful_hacks, failed_hacks, hack_multiplier = calculate_hack_success(
                hacks_used, target['security'], target['difficulty']
            )
            
            # Calculate final multiplier (blend: 70% base, 30% hacks)
            blended_multiplier = (base_multiplier * Decimal("0.7")) + (hack_multiplier * Decimal("0.3"))
            
            # Apply bank multiplier
            final_multiplier = blended_multiplier * Decimal(str(target['base_multiplier']))
            
            # Ensure multiplier stays within 0.5x-3.5x range
            final_multiplier = max(Decimal("0.5"), min(Decimal("3.5"), final_multiplier))
            
            # Check escape success (based on hack performance)
            escape_success_rate = len(successful_hacks) / len(hacks_used) if hacks_used else 0
            escape_success = random.random() < (0.5 + escape_success_rate * 0.5)  # 50-100% chance
            
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
            'successful': successful_hacks if not is_failed_scenario else [],
            'failed': failed_hacks if not is_failed_scenario else hacks_used,
            'count': len(hacks_used),
            'success_count': len(successful_hacks) if not is_failed_scenario else 0,
            'failed_count': len(failed_hacks) if not is_failed_scenario else len(hacks_used),
            'was_failed_scenario': is_failed_scenario
        }

        heist = CyberHeist.objects.create(
            user=user,
            bet_amount=bet_amount,
            target_bank=target["name"],
            security_level=target["security"],
            hacks_used=hacks_used,
            escape_success=win_amount > 0,  # Escape success determined by win
            win_amount=win_amount,
            win_ratio=float(win_multiplier),  # Store multiplier as win ratio
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
        if win_amount > 0:
            win_tier = heist_tier

        return Response({
            "target_bank": target,
            "hacks_used": hacks_used,
            "hack_results": hack_results,
            "escape_success": win_amount > 0,
            "successful_hacks": len(successful_hacks) if not is_failed_scenario else 0,
            "failed_hacks": len(failed_hacks) if not is_failed_scenario else len(hacks_used),
            "hack_multiplier": float(hack_multiplier) if not is_failed_scenario else 0.0,
            "base_multiplier": float(base_multiplier) if not is_failed_scenario else 0.0,
            "bank_multiplier": float(target['base_multiplier']),
            "win_amount": float(win_amount),
            "win_multiplier": float(win_multiplier) if win_amount > 0 else 0.0,
            "win_ratio": float(win_multiplier) if win_amount > 0 else 0.0,
            "win_tier": win_tier,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "heist_id": heist.id,
            "was_failed_scenario": is_failed_scenario,
            "game_info": {
                "win_chance": "70%",
                "multiplier_range": "0.5x - 3.5x",
                "failed_chance": "30%",
                "hacks_used": len(hacks_used)
            }
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
            'small_rate': round(small_rate, 2),
            'medium_rate': round(medium_rate, 2),
            'large_rate': round(large_rate, 2),
            'epic_rate': round(epic_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'highest_heist': round(float(stats.highest_heist), 2),
            'highest_multiplier': round(stats.highest_win_ratio, 2),
            'favorite_bank': stats.favorite_bank,
            'total_hacks_attempted': stats.total_hacks_attempted,
            'avg_hacks_per_heist': round(avg_hacks, 2),
            'hacker_rank': hacker_rank,
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
                if heist.win_ratio <= 1.5:
                    win_tier = "small"
                elif heist.win_ratio <= 2.5:
                    win_tier = "medium"
                elif heist.win_ratio <= 3.0:
                    win_tier = "large"
                else:
                    win_tier = "epic"

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
    Get detailed cyber heist game information
    """
    return Response({
        'game_info': {
            'name': 'Cyber Heist',
            'description': 'Hack into digital banks using various cyber attacks!',
            'win_chance': '70%',
            'failed_chance': '30%',
            'multiplier_range': '0.5x - 3.5x',
            'minimum_bet': '100.00',
        },
        'banks': BANKS,
        'hacks': HACKS,
        'failed_hacks': FAILED_HACKS,
        'multiplier_distribution': {
            'small': '0.5x - 1.5x (40% of wins)',
            'medium': '1.6x - 2.5x (40% of wins)',
            'large': '2.6x - 3.0x (15% of wins)',
            'epic': '3.1x - 3.5x (5% of wins)'
        },
        'bank_difficulty': {
            'easy': 'Quantum Bank: 3 security, 1.0x multiplier',
            'medium': 'Neo Financial: 5 security, 1.2x multiplier',
            'hard': 'Cyber Trust: 7 security, 1.5x multiplier',
            'expert': 'Digital Vault: 9 security, 2.0x multiplier'
        },
        'hack_success_rates': {
            'Zero Day Exploit': '90% success rate',
            'Social Engineering': '85% success rate',
            'Phishing Attack': '80% success rate',
            'Malware Payload': '80% success rate',
            'SQL Injection': '70% success rate',
            'Man-in-the-Middle': '75% success rate',
            'Brute Force': '60% success rate',
            'DDoS Attack': '65% success rate'
        },
        'expected_rtp': '97%',
        'house_edge': '3%',
    })