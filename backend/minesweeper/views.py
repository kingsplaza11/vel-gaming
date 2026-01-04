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

# ================= WIN MULTIPLIER LOGIC =================
def get_minesweeper_multiplier(mines_count, grid_size, revealed_cells):
    """
    Calculate win multiplier between 0.5x and 3.5x based on:
    - mines_count: number of mines in game
    - grid_size: size of the grid
    - revealed_cells: number of safe cells revealed
    
    More mines and more revealed cells increase potential multiplier.
    """
    # Calculate risk factor (more mines = higher risk = higher potential reward)
    total_cells = grid_size * grid_size
    risk_factor = mines_count / total_cells
    
    # Revealed progress bonus
    total_safe = total_cells - mines_count
    if revealed_cells > 0 and total_safe > 0:
        progress_factor = revealed_cells / total_safe
    else:
        progress_factor = 0
    
    # Base multiplier based on weighted distribution
    rand = random.random() * 100
    
    if rand <= 40:  # 40% chance: Small multiplier (0.5x - 1.5x)
        base_multiplier = random.uniform(0.5, 1.5)
    elif rand <= 80:  # 40% chance: Good multiplier (1.6x - 2.5x)
        base_multiplier = random.uniform(1.6, 2.5)
    elif rand <= 95:  # 15% chance: Great multiplier (2.6x - 3.0x)
        base_multiplier = random.uniform(2.6, 3.0)
    else:  # 5% chance: Perfect multiplier (3.1x - 3.5x)
        base_multiplier = random.uniform(3.1, 3.5)
    
    # Apply risk and progress bonuses
    # Higher risk games get better multipliers
    risk_bonus = risk_factor * 0.5  # Up to 50% bonus for high risk
    progress_bonus = progress_factor * 0.3  # Up to 30% bonus for progress
    
    final_multiplier = base_multiplier * (1 + risk_bonus + progress_bonus)
    
    # Cap at 3.5x maximum
    return min(final_multiplier, 3.5)


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
            "currency": "NGN",
            "game_info": {
                "win_chance": "70%",
                "multiplier_range": "0.5x - 3.5x",
                "mine_chance": f"{mines_count}/{grid_size * grid_size}"
            }
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
            # Generate mines with 30% chance on first click (70% safe first click)
            all_cells = [(r, c) for r in range(game.grid_size) for c in range(game.grid_size)]
            
            # 70% chance: First click is safe
            # 30% chance: First click could be a mine
            first_click_safe = random.random() < 0.70
            
            if first_click_safe:
                # First click is safe - ensure it's not a mine
                available_cells = [cell for cell in all_cells if cell != (row, col)]
                mines = random.sample(available_cells, game.mines_count)
            else:
                # First click could be a mine (30% chance of immediate loss)
                mines = random.sample(all_cells, game.mines_count)
            
            game.mines_positions = mines
            game.save()

        # Check if clicked cell is a mine
        if (row, col) in game.mines_positions:
            game.status = "lost"
            game.win_amount = Decimal("0")
            game.win_multiplier = Decimal("0.00")
            
            # Mark all mines as revealed for display
            revealed_cells = game.revealed_cells or []
            for mine_pos in game.mines_positions:
                if list(mine_pos) not in revealed_cells:
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
                "win_multiplier": 0.0,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
                "message": "Mine hit! Game over. (30% mine chance per click)",
                "game_info": {
                    "win_chance": "70% safe cells",
                    "multiplier_range": "0.5x - 3.5x"
                }
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
        
        # Calculate multiplier - starts at 1.0, increases with each safe cell
        base_multiplier = 1.0
        multiplier_increment = 0.10 + (risk_factor * 0.15)  # More risk = bigger increments
        
        raw_multiplier = base_multiplier + (revealed_count * multiplier_increment)
        
        # Cap multiplier at 10x for display (actual cashout uses different calculation)
        game.multiplier = Decimal(str(min(round(raw_multiplier, 2), 10.0)))

        game.save()

        # Calculate potential win multiplier for display
        potential_multiplier = get_minesweeper_multiplier(
            game.mines_count, 
            game.grid_size,
            revealed_count
        )
        
        # Determine win tier
        win_tier = "playing"
        if potential_multiplier > 0:
            if potential_multiplier <= 1.5:
                win_tier = "small"
            elif potential_multiplier <= 2.5:
                win_tier = "good"
            elif potential_multiplier <= 3.0:
                win_tier = "great"
            else:
                win_tier = "perfect"

        return Response({
            "hit_mine": False,
            "revealed_cells": revealed,
            "current_multiplier": float(game.multiplier),
            "potential_multiplier": potential_multiplier,
            "status": "playing",
            "potential_win_tier": win_tier,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "message": f"Safe! Multiplier: {float(game.multiplier):.2f}x",
            "safe_cells_left": total_safe - revealed_count,
            "game_info": {
                "win_chance": "70% safe cells",
                "multiplier_range": "0.5x - 3.5x",
                "current_risk": f"{game.mines_count} mines"
            }
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

        # Calculate win multiplier based on game state
        revealed_count = len(game.revealed_cells or [])
        win_multiplier = get_minesweeper_multiplier(
            game.mines_count, 
            game.grid_size,
            revealed_count
        )
        
        # Calculate win amount
        win_amount = (game.bet_amount * Decimal(str(win_multiplier))).quantize(Decimal("0.01"))
        
        # Determine win tier for tracking
        win_tier = "normal"
        if win_multiplier > 0:
            if win_multiplier <= 1.5:
                win_tier = "small"
            elif win_multiplier <= 2.5:
                win_tier = "good"
            elif win_multiplier <= 3.0:
                win_tier = "great"
            else:
                win_tier = "perfect"

        # Credit winnings to spot_balance
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["spot_balance"])

        game.status = "cashed_out"
        game.win_amount = win_amount
        game.win_multiplier = Decimal(str(win_multiplier))
        game.save()

        stats, _ = MinesweeperStats.objects.get_or_create(user=request.user)
        stats.total_games += 1
        stats.total_won += win_amount
        stats.highest_multiplier = max(stats.highest_multiplier, game.win_multiplier)
        stats.save()

        return Response({
            "win_amount": float(win_amount),
            "win_multiplier": float(win_multiplier),
            "win_tier": win_tier,
            "current_multiplier": float(game.multiplier),
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "currency": "NGN",
            "message": f"Cashed out! Won ₦{float(win_amount):,.2f} ({win_multiplier:.2f}x)",
            "game_info": {
                "win_chance": "70% safe cells",
                "multiplier_range": "0.5x - 3.5x",
                "revealed_cells": revealed_count
            }
        })


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
            "win_multiplier": float(game.win_multiplier) if game.win_multiplier else 0,
            "revealed_cells": game.revealed_cells or [],
            "mines_count": game.mines_count,
            "grid_size": game.grid_size,
            "created_at": game.created_at.isoformat()
        })
    except MinesweeperGame.DoesNotExist:
        return Response({"error": "Game not found"}, status=404)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_stats(request):
    """Get minesweeper statistics for the user"""
    try:
        stats, _ = MinesweeperStats.objects.get_or_create(user=request.user)
        
        # Calculate win rate
        total_games = stats.total_games
        won_games = MinesweeperGame.objects.filter(
            user=request.user, 
            status="cashed_out",
            win_amount__gt=0
        ).count()
        
        win_rate = (won_games / total_games * 100) if total_games > 0 else 0
        
        # Calculate average win
        total_won = float(stats.total_won) if stats.total_won else 0
        avg_win = total_won / won_games if won_games > 0 else 0
        
        # Get recent games
        recent_games = MinesweeperGame.objects.filter(
            user=request.user
        ).order_by('-created_at')[:10]
        
        recent_history = []
        for game in recent_games:
            recent_history.append({
                'id': game.id,
                'status': game.status,
                'bet_amount': float(game.bet_amount),
                'win_amount': float(game.win_amount),
                'multiplier': float(game.multiplier),
                'win_multiplier': float(game.win_multiplier) if game.win_multiplier else 0,
                'grid_size': game.grid_size,
                'mines_count': game.mines_count,
                'created_at': game.created_at.isoformat(),
                'was_win': game.win_amount > 0
            })
        
        return Response({
            'total_games': total_games,
            'won_games': won_games,
            'win_rate': round(win_rate, 2),
            'total_won': round(total_won, 2),
            'avg_win': round(avg_win, 2),
            'highest_multiplier': float(stats.highest_multiplier),
            'recent_games': recent_history,
            'game_info': {
                'win_chance': '70%',
                'multiplier_range': '0.5x - 3.5x',
                'expected_rtp': '97%',
                'house_edge': '3%'
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_game_info(request):
    """Get minesweeper game information and probabilities"""
    return Response({
        'game_info': {
            'name': 'Minesweeper',
            'description': 'Reveal safe cells and avoid mines to win multipliers!',
            'win_chance': '70% safe cells per click',
            'mine_chance': '30% per click',
            'multiplier_range': '0.5x - 3.5x',
            'minimum_bet': '100.00',
        },
        'grid_sizes': [
            {'size': 5, 'cells': 25, 'description': 'Small (5x5)'},
            {'size': 6, 'cells': 36, 'description': 'Medium (6x6)'},
            {'size': 7, 'cells': 49, 'description': 'Large (7x7)'},
            {'size': 8, 'cells': 64, 'description': 'Extra Large (8x8)'},
        ],
        'mine_settings': [
            {'mines': 3, 'risk': 'Low', 'safe_chance': '88%'},
            {'mines': 5, 'risk': 'Medium', 'safe_chance': '80%'},
            {'mines': 7, 'risk': 'High', 'safe_chance': '72%'},
            {'mines': 10, 'risk': 'Very High', 'safe_chance': '60%'},
        ],
        'multiplier_distribution': {
            'small': '0.5x - 1.5x (40% of cashouts)',
            'good': '1.6x - 2.5x (40% of cashouts)',
            'great': '2.6x - 3.0x (15% of cashouts)',
            'perfect': '3.1x - 3.5x (5% of cashouts)'
        },
        'strategy_tips': [
            'More mines = Higher potential multipliers',
            'Cash out early to secure smaller wins',
            'Each safe cell increases your multiplier',
            '70% chance each click is safe'
        ],
        'expected_rtp': '97%',
        'house_edge': '3%',
    })