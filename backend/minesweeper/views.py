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
import logging

logger = logging.getLogger(__name__)

# ================= WIN RATIO LOGIC =================
def get_minesweeper_win_ratio(multiplier, mines_count, grid_size, revealed_cells):
    """
    Calculate dynamic win ratio based on:
    - multiplier: current game multiplier
    - mines_count: number of mines in game
    - grid_size: size of the grid
    - revealed_cells: number of safe cells revealed
    
    Higher multipliers, more mines, and larger grids increase 
    chances of better win ratios.
    """
    # Base probabilities
    rand = random.random() * 100
    
    # Risk factor: more mines = higher potential rewards
    risk_factor = mines_count / (grid_size * grid_size)
    
    # Revealed cells bonus: more safe cells revealed = higher ratio
    total_safe = grid_size**2 - mines_count
    if revealed_cells > 0:
        revealed_bonus = (revealed_cells / total_safe) * 0.3  # Up to 30% bonus
    else:
        revealed_bonus = 0
    
    # Base win tier probabilities
    if rand <= 40:  # 40% chance: Lower tier (5-25%)
        base_ratio = random.uniform(0.05, 0.25)
    elif rand <= 75:  # 35% chance: Normal tier (26-50%)
        base_ratio = random.uniform(0.26, 0.50)
    elif rand <= 90:  # 15% chance: High tier (51-100%)
        base_ratio = random.uniform(0.51, 1.00)
    elif rand <= 98:  # 8% chance: Jackpot tier (101-180%)
        base_ratio = random.uniform(1.01, 1.80)
    else:  # 2% chance: Mega jackpot (181-250%)
        base_ratio = random.uniform(1.81, 2.50)
    
    # Apply bonuses
    final_ratio = base_ratio * (1 + risk_factor * 0.3 + revealed_bonus)
    
    # Cap at 250% maximum
    return min(final_ratio, 2.5)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_minesweeper(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount")))
        grid_size = int(request.data.get("grid_size", 5))
        mines_count = int(request.data.get("mines_count", 5))
    except Exception as e:
        logger.error(f"Error parsing parameters: {str(e)}")
        return Response({"error": "Invalid parameters"}, status=400)

    if bet_amount < Decimal("100"):
        return Response({"error": "Minimum stake is ₦100"}, status=400)

    if mines_count >= grid_size * grid_size:
        return Response({"error": "Too many mines"}, status=400)
    
    if mines_count < 1:
        return Response({"error": "At least 1 mine required"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        # Check combined balance (wallet + spot)
        combined_balance = wallet.balance + wallet.spot_balance
        
        if combined_balance < bet_amount:
            return Response({"error": "Insufficient balance (wallet + spot)"}, status=400)

        # Deduct from spot_balance first, then main balance
        remaining_cost = bet_amount
        
        if wallet.balance >= remaining_cost:
            wallet.balance -= remaining_cost
            remaining_cost = Decimal("0.00")
        else:
            remaining_cost -= wallet.balance
            wallet.balance = Decimal("0.00")
            wallet.spot_balance -= remaining_cost
            
        wallet.save(update_fields=["balance", "spot_balance"])

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
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "currency": "NGN"
        })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reveal_cell(request):
    try:
        game_id = request.data["game_id"]
        row = int(request.data["row"])
        col = int(request.data["col"])
    except Exception as e:
        logger.error(f"Error parsing reveal parameters: {str(e)}")
        return Response({"error": "Invalid parameters"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = MinesweeperGame.objects.select_for_update().get(
            id=game_id, user=request.user, status="playing"
        )

        # Generate mines if not already generated
        if not game.mines_positions:
            safe_cells = [(r, c) for r in range(game.grid_size) for c in range(game.grid_size)]
            # Don't guarantee first click is safe - REAL MINESWEEPER STYLE!
            # Generate mines randomly across entire grid
            all_cells = [(r, c) for r in range(game.grid_size) for c in range(game.grid_size)]
            mines = random.sample(all_cells, game.mines_count)
            game.mines_positions = mines
            game.save()

        # Check if clicked cell is a mine
        if (row, col) in game.mines_positions:
            game.status = "lost"
            game.win_amount = Decimal("0")
            game.win_ratio = 0.0
            
            # Mark all mines as revealed for display
            revealed_cells = game.revealed_cells or []
            for mine_pos in game.mines_positions:
                if mine_pos not in revealed_cells:
                    revealed_cells.append(list(mine_pos))
            game.revealed_cells = revealed_cells
            
            game.save()

            # Update stats
            stats, _ = MinesweeperStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.save()

            return Response({
                "hit_mine": True,
                "status": "lost",
                "mines_positions": game.mines_positions,
                "revealed_cells": game.revealed_cells,
                "win_amount": 0,
                "win_ratio": 0.0,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
                "message": "Mine hit! Game over."
            })

        # Cell is safe - add to revealed cells
        revealed = game.revealed_cells or []
        if [row, col] not in revealed:
            revealed.append([row, col])
            game.revealed_cells = revealed

        # Calculate multiplier based on revealed cells
        total_safe = game.grid_size**2 - game.mines_count
        revealed_count = len(revealed)
        
        # More aggressive multiplier growth for riskier games
        risk_factor = game.mines_count / (game.grid_size * game.grid_size)
        
        # Calculate multiplier with exponential growth
        # Base starts at 1.0, increases with each safe cell revealed
        base_multiplier = 1.0
        multiplier_increment = 0.15 + (risk_factor * 0.1)  # More risk = bigger increments
        
        raw_multiplier = base_multiplier + (revealed_count * multiplier_increment)
        game.multiplier = Decimal(str(round(raw_multiplier, 2)))

        game.save()

        # Calculate potential win ratio for display
        potential_win_ratio = get_minesweeper_win_ratio(
            float(game.multiplier), 
            game.mines_count, 
            game.grid_size,
            revealed_count
        )
        
        # Determine win tier
        win_tier = "playing"
        if potential_win_ratio > 0:
            if potential_win_ratio <= 0.25:
                win_tier = "low"
            elif potential_win_ratio <= 0.50:
                win_tier = "normal"
            elif potential_win_ratio <= 1.00:
                win_tier = "high"
            elif potential_win_ratio <= 1.80:
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        return Response({
            "hit_mine": False,
            "revealed_cells": revealed,
            "multiplier": float(game.multiplier),
            "status": "playing",
            "potential_win_ratio": potential_win_ratio,
            "potential_win_tier": win_tier,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "message": f"Safe! Multiplier: {float(game.multiplier):.2f}x"
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

        # Calculate dynamic win ratio based on game state
        revealed_count = len(game.revealed_cells or [])
        win_ratio = get_minesweeper_win_ratio(
            float(game.multiplier), 
            game.mines_count, 
            game.grid_size,
            revealed_count
        )
        
        # Base win amount
        win_amount = (game.bet_amount * Decimal(str(win_ratio))).quantize(Decimal("0.01"))
        
        # Apply multiplier bonus (up to 50% extra)
        multiplier_bonus = min(float(game.multiplier) / 3.0, 0.5)  # Cap at 50% bonus
        win_amount = (win_amount * Decimal(str(1 + multiplier_bonus))).quantize(Decimal("0.01"))
        
        # Determine win tier for tracking
        win_tier = "normal"
        if win_ratio > 0:
            if win_ratio <= 0.25:
                win_tier = "low"
            elif win_ratio <= 0.50:
                win_tier = "normal"
            elif win_ratio <= 1.00:
                win_tier = "high"
            elif win_ratio <= 1.80:
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        # Credit winnings to spot_balance
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["spot_balance"])

        game.status = "cashed_out"
        game.win_amount = win_amount
        game.win_ratio = win_ratio
        game.save()

        stats, _ = MinesweeperStats.objects.get_or_create(user=request.user)
        stats.total_games += 1
        stats.total_won += win_amount
        stats.highest_multiplier = max(stats.highest_multiplier, game.multiplier)
        if win_ratio > stats.highest_win_ratio:
            stats.highest_win_ratio = win_ratio
        stats.save()

        return Response({
            "win_amount": float(win_amount),
            "win_ratio": float(win_ratio),
            "win_tier": win_tier,
            "multiplier": float(game.multiplier),
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "currency": "NGN",
            "message": f"Cashed out! Won ₦{float(win_amount):,.2f}"
        })


# Add a new endpoint for game status
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_game_status(request, game_id):
    try:
        game = MinesweeperGame.objects.get(id=game_id, user=request.user)
        
        return Response({
            "game_id": game.id,
            "status": game.status,
            "multiplier": float(game.multiplier),
            "win_amount": float(game.win_amount),
            "win_ratio": float(game.win_ratio),
            "revealed_cells": game.revealed_cells or [],
            "mines_count": game.mines_count,
            "grid_size": game.grid_size,
            "created_at": game.created_at.isoformat()
        })
    except MinesweeperGame.DoesNotExist:
        return Response({"error": "Game not found"}, status=404)