# minesweeper/views.py
import random
from decimal import Decimal
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MinesweeperGame, MinesweeperStats
from wallets.models import Wallet

MAX_PROFIT_RATIO = Decimal("0.30")  # 30%

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_minesweeper(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount")))
        grid_size = int(request.data.get("grid_size", 5))
        mines_count = int(request.data.get("mines_count", 5))
    except Exception:
        return Response({"error": "Invalid parameters"}, status=400)

    if bet_amount <= 0:
        return Response({"error": "Invalid stake"}, status=400)

    if mines_count >= grid_size * grid_size:
        return Response({"error": "Too many mines"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        if wallet.balance < bet_amount:
            return Response({"error": "Insufficient balance"}, status=400)

        wallet.balance -= bet_amount
        wallet.save(update_fields=["balance"])

        game = MinesweeperGame.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            grid_size=grid_size,
            mines_count=mines_count,
            multiplier=Decimal("1.0"),
            status="playing",
        )

        return Response({
            "game_id": game.id,
            "new_balance": float(wallet.balance),
            "currency": "NGN"
        })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reveal_cell(request):
    try:
        game_id = request.data["game_id"]
        row = int(request.data["row"])
        col = int(request.data["col"])
    except Exception:
        return Response({"error": "Invalid parameters"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = MinesweeperGame.objects.select_for_update().get(
            id=game_id, user=request.user, status="playing"
        )

        if not game.mines_positions:
            safe_cells = [(r, c) for r in range(game.grid_size) for c in range(game.grid_size)]
            safe_cells.remove((row, col))
            game.mines_positions = random.sample(safe_cells, game.mines_count)

        if (row, col) in game.mines_positions:
            game.status = "lost"
            game.win_amount = Decimal("0")
            game.save()

            MinesweeperStats.objects.get_or_create(user=request.user)[0].total_games += 1

            return Response({
                "hit_mine": True,
                "status": "lost",
                "win_amount": 0,
                "new_balance": float(wallet.balance),
            })

        revealed = game.revealed_cells or []
        if (row, col) not in revealed:
            revealed.append((row, col))
            game.revealed_cells = revealed

        total_safe = game.grid_size**2 - game.mines_count
        raw_multiplier = Decimal(len(revealed)) / Decimal(total_safe) * Decimal("2.0")
        game.multiplier = min(raw_multiplier, Decimal("1.3"))  # 🔒 hard cap

        game.save()

        return Response({
            "hit_mine": False,
            "revealed_cells": revealed,
            "multiplier": float(game.multiplier),
            "status": "playing",
        })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cash_out(request):
    game_id = request.data.get("game_id")

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = MinesweeperGame.objects.select_for_update().get(
            id=game_id, user=request.user, status="playing"
        )

        max_win = game.bet_amount * (Decimal("1.0") + MAX_PROFIT_RATIO)
        raw_win = game.bet_amount * game.multiplier
        win_amount = min(raw_win, max_win)

        wallet.balance += win_amount
        wallet.save(update_fields=["balance"])

        game.status = "cashed_out"
        game.win_amount = win_amount
        game.save()

        stats, _ = MinesweeperStats.objects.get_or_create(user=request.user)
        stats.total_games += 1
        stats.total_won += win_amount
        stats.highest_multiplier = max(stats.highest_multiplier, game.multiplier)
        stats.save()

        return Response({
            "win_amount": float(win_amount),
            "multiplier": float(game.multiplier),
            "new_balance": float(wallet.balance),
            "currency": "NGN"
        })
