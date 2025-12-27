import random
from decimal import Decimal
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import ColorSwitchGame, ColorSwitchStats
from wallets.models import Wallet

COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']
MAX_PROFIT_RATIO = Decimal("0.50")


@api_view(['POST'])
def start_color_switch(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Auth required'}, status=401)

    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        sequence_length = int(request.data.get('sequence_length'))
    except:
        return Response({'error': 'Invalid input'}, status=400)

    if bet_amount <= 0:
        return Response({'error': 'Invalid stake'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        if wallet.balance < bet_amount:
            return Response({'error': 'Insufficient balance'}, status=400)

        wallet.balance -= bet_amount
        wallet.save()

        sequence = [random.choice(COLORS) for _ in range(sequence_length)]

        game = ColorSwitchGame.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            sequence_length=sequence_length,
            current_sequence=sequence,
            multiplier=Decimal("1.0"),
            status="showing"
        )

        return Response({
            "game_id": game.id,
            "sequence": sequence,
            "new_balance": float(wallet.balance)
        })


@api_view(['POST'])
def submit_sequence(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Auth required'}, status=401)

    game_id = request.data.get("game_id")
    player_sequence = request.data.get("player_sequence", [])

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = ColorSwitchGame.objects.select_for_update().get(
            id=game_id, user=request.user, status__in=["playing", "showing"]
        )

        if player_sequence != game.current_sequence:
            game.status = "lost"
            game.win_amount = Decimal("0")
            game.save()

            stats, _ = ColorSwitchStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.longest_sequence = max(stats.longest_sequence, game.sequence_length)
            stats.save()

            return Response({
                "status": "lost",
                "new_balance": float(wallet.balance)
            })

        # Correct sequence → grow difficulty
        game.sequence_length += 1
        game.current_sequence = [random.choice(COLORS) for _ in range(game.sequence_length)]

        raw_multiplier = Decimal("1") + (Decimal(game.sequence_length - 4) * Decimal("0.15"))
        game.multiplier = raw_multiplier
        game.status = "showing"
        game.save()

        return Response({
            "status": "correct",
            "next_sequence": game.current_sequence,
            "multiplier": float(raw_multiplier),
            "sequence_length": game.sequence_length
        })


@api_view(['POST'])
def cash_out_colors(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Auth required'}, status=401)

    game_id = request.data.get("game_id")

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = ColorSwitchGame.objects.select_for_update().get(
            id=game_id, user=request.user, status="showing"
        )

        max_profit = game.bet_amount * MAX_PROFIT_RATIO
        win_amount = max_profit

        wallet.balance += win_amount
        wallet.save()

        game.win_amount = win_amount
        game.status = "cashed_out"
        game.save()

        stats, _ = ColorSwitchStats.objects.get_or_create(user=request.user)
        stats.total_games += 1
        stats.total_won += win_amount
        stats.longest_sequence = max(stats.longest_sequence, game.sequence_length)
        stats.save()

        return Response({
            "win_amount": float(win_amount),
            "new_balance": float(wallet.balance)
        })
