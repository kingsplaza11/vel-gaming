import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import GuessingGame, GuessingStats
from wallets.models import Wallet

MAX_PROFIT_RATIO = Decimal("0.30")


@api_view(['POST'])
def start_guessing(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        max_number = int(request.data.get('max_number'))
        max_attempts = int(request.data.get('max_attempts'))
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    if bet_amount <= 0:
        return Response({'error': 'Invalid stake'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        if wallet.balance < bet_amount:
            return Response({'error': 'Insufficient balance'}, status=400)

        wallet.balance -= bet_amount
        wallet.save()

        game = GuessingGame.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            target_number=random.randint(1, max_number),
            max_number=max_number,
            max_attempts=max_attempts,
            attempts=0,
            multiplier=Decimal("1.0"),
            status="playing"
        )

        return Response({
            "game_id": game.id,
            "new_balance": float(wallet.balance),
            "max_number": max_number,
            "max_attempts": max_attempts
        })


@api_view(['POST'])
def make_guess(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    try:
        game_id = request.data.get("game_id")
        guess = int(request.data.get("guess"))
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = GuessingGame.objects.select_for_update().get(
            id=game_id, user=request.user, status="playing"
        )

        game.attempts += 1

        if guess == game.target_number:
            remaining = game.max_attempts - game.attempts
            raw_multiplier = Decimal("1.0") + (Decimal(remaining) / Decimal(game.max_attempts)) * Decimal("3.0")

            max_profit = game.bet_amount * MAX_PROFIT_RATIO
            win_amount = min(max_profit, game.bet_amount * (raw_multiplier - 1))

            wallet.balance += win_amount
            wallet.save()

            game.multiplier = raw_multiplier
            game.win_amount = win_amount
            game.status = "won"
            game.save()

            stats, _ = GuessingStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.games_won += 1
            stats.total_won += win_amount
            stats.save()

            return Response({
                "status": "won",
                "correct": True,
                "win_amount": float(win_amount),
                "multiplier": float(raw_multiplier),
                "new_balance": float(wallet.balance)
            })

        if game.attempts >= game.max_attempts:
            game.status = "lost"
            game.win_amount = Decimal("0")
            game.save()

            stats, _ = GuessingStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.save()

            return Response({
                "status": "lost",
                "correct": False,
                "target_number": game.target_number,
                "new_balance": float(wallet.balance)
            })

        game.save()

        return Response({
            "status": "playing",
            "correct": False,
            "hint": "higher" if guess < game.target_number else "lower",
            "attempts": game.attempts,
            "remaining_attempts": game.max_attempts - game.attempts
        })
