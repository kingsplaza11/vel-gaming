# views.py
import random
from decimal import Decimal
from django.db import transaction
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import SlotGame, SlotStats
from wallets.models import Wallet   # ✅ USE WALLET

SYMBOLS = {
    'classic': ['seven', 'bar', 'bell', 'cherry', 'orange', 'lemon'],
    'fruit': ['watermelon', 'grapes', 'orange', 'cherry', 'lemon', 'plum'],
    'diamond': ['diamond', 'ruby', 'emerald', 'sapphire', 'gold', 'silver'],
    'ancient': ['scarab', 'pyramid', 'sphinx', 'ankh', 'eye', 'pharaoh']
}

@api_view(['POST'])
def spin_slots(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    theme = request.data.get('theme', 'classic')

    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
    except:
        return Response({'error': 'Invalid bet'}, status=400)

    if bet_amount <= 0:
        return Response({'error': 'Invalid stake'}, status=400)

    if theme not in SYMBOLS:
        return Response({'error': 'Invalid theme'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        if wallet.balance < bet_amount:
            return Response({'error': 'Insufficient balance'}, status=400)

        # 🔻 Deduct stake
        if wallet.balance >= remaining_cost:
            wallet.balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.balance
            wallet.balance = Decimal("0.00")
            wallet.spot_balance -= remaining_cost

        wallet.save(update_fields=['balance', 'spot_balance'])

        reels = [random.choice(SYMBOLS[theme]) for _ in range(12)]

        # 🎯 WIN LOGIC (simple but controlled)
        raw_win = Decimal('0')

        if random.random() < 0.30:  # ≤ 30% win chance
            raw_win = bet_amount * Decimal(str(random.uniform(0.05, 0.3)))

        # 🔒 HARD CAP (MAX PROFIT = 30%)
        max_profit = bet_amount * Decimal('0.30')
        win_amount = min(raw_win, max_profit)

        if win_amount > 0:
            wallet.spot_balance += win_amount
            wallet.save(update_fields=['spot_balance'])

        SlotGame.objects.create(
            user=request.user,
            theme=theme,
            bet_amount=bet_amount,
            win_amount=win_amount,
            result={'reels': reels}
        )

        stats, _ = SlotStats.objects.get_or_create(user=request.user)
        stats.total_spins += 1
        stats.total_bet += bet_amount
        stats.total_won += win_amount
        stats.save()

        return Response({
            'reels': reels,
            'win_amount': float(win_amount),
            'wallet_balance': float(wallet.balance)
        })
