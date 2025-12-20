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

MIN_STAKE = Decimal("1000")
MAX_PROFIT_RATIO = Decimal("0.30")

BANKS = [
    {'name': 'Quantum Bank', 'security': 3, 'base_multiplier': 1.2, 'image': '🔒'},
    {'name': 'Neo Financial', 'security': 5, 'base_multiplier': 1.4, 'image': '💳'},
    {'name': 'Cyber Trust', 'security': 7, 'base_multiplier': 1.6, 'image': '🖥️'},
    {'name': 'Digital Vault', 'security': 9, 'base_multiplier': 1.9, 'image': '🏦'},
]

HACKS = [
    {'name': 'Phishing Attack', 'success_rate': 0.7, 'image': '🎣'},
    {'name': 'Brute Force', 'success_rate': 0.5, 'image': '🔨'},
    {'name': 'SQL Injection', 'success_rate': 0.6, 'image': '💉'},
    {'name': 'Zero Day Exploit', 'success_rate': 0.9, 'image': '🕵️'},
]

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_heist(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount")))
        target_name = request.data.get("target_bank")
    except (InvalidOperation, TypeError):
        return Response({"error": "Invalid parameters"}, status=400)

    if bet_amount < MIN_STAKE:
        return Response({"error": "Minimum stake is ₦1,000"}, status=400)

    target = next((b for b in BANKS if b["name"] == target_name), None)
    if not target:
        return Response({"error": "Invalid target"}, status=400)

    with transaction.atomic():
        user = User.objects.select_for_update().get(id=request.user.id)
        wallet = Wallet.objects.select_for_update().get(user=user)

        if wallet.balance < bet_amount:
            return Response({"error": "Insufficient wallet balance"}, status=400)

        # Deduct stake (user can lose everything)
        wallet.balance -= bet_amount
        wallet.save(update_fields=["balance"])

        hacks_used = []
        success_score = Decimal("1.0")
        escape_success = True

        for _ in range(3):
            hack = random.choice(HACKS)
            hacks_used.append(hack)

            adjusted = hack["success_rate"] * (5 / target["security"])
            if random.random() < adjusted:
                success_score *= Decimal("1.05")
            else:
                if random.random() < 0.35:
                    escape_success = False

        raw_win = (
            bet_amount
            * Decimal(str(target["base_multiplier"]))
            * success_score
        )

        max_win = bet_amount * MAX_PROFIT_RATIO
        win_amount = min(raw_win, max_win) if escape_success else Decimal("0")

        wallet.balance += win_amount
        wallet.save(update_fields=["balance"])

        CyberHeist.objects.create(
            user=user,
            bet_amount=bet_amount,
            target_bank=target["name"],
            security_level=target["security"],
            hacks_used=hacks_used,
            escape_success=escape_success,
            win_amount=win_amount,
        )

        stats, _ = HeistStats.objects.get_or_create(user=user)
        stats.total_heists += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        if escape_success:
            stats.successful_heists += 1
        stats.highest_heist = max(stats.highest_heist, win_amount)
        stats.save()

        return Response({
            "target_bank": target,
            "hacks_used": hacks_used,
            "escape_success": escape_success,
            "win_amount": float(win_amount),
            "new_balance": float(wallet.balance),
        })
