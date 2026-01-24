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

# Updated probability constants - 25% safe, 75% bomb (HIGH RISK)
SAFE_CELL_CHANCE = 0.25  # 25% chance first click is safe
MINE_CELL_CHANCE = 0.75  # 75% chance first click is a mine (HIGH RISK)

# Win multiplier constants - Adjusted for higher risk
ABOVE_1_5X_CHANCE = 0.50  # 50% chance to win above 1.5x (increased due to higher risk)
BELOW_1_5X_CHANCE = 0.15  # 15% chance to win below 1.5x (increased due to higher risk)

# ================= WIN MULTIPLIER LOGIC =================
def get_minesweeper_multiplier(mines_count, grid_size, revealed_cells, win_type):
    """
    Calculate win multiplier based on win type:
    - 'above_1_5x': multipliers from 1.6x to 5.0x (increased max due to higher risk)
    - 'below_1_5x': multipliers from 0.5x to 1.49x
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
    
    if win_type == 'above_1_5x':
        # 50% chance - good wins above 1.5x (HIGHER REWARDS FOR HIGHER RISK)
        rand = random.random()
        if rand < 0.40:  # 40% of above-1.5x wins: 1.6x - 2.5x
            base_multiplier = random.uniform(1.6, 2.5)
        elif rand < 0.70:  # 30% of above-1.5x wins: 2.6x - 3.5x
            base_multiplier = random.uniform(2.6, 3.5)
        elif rand < 0.90:  # 20% of above-1.5x wins: 3.6x - 4.5x
            base_multiplier = random.uniform(3.6, 4.5)
        else:  # 10% of above-1.5x wins: 4.6x - 5.0x (HIGHER MAX)
            base_multiplier = random.uniform(4.6, 5.0)
    else:
        # 15% chance - small wins below 1.5x
        base_multiplier = random.uniform(0.5, 1.49)
    
    # Apply risk and progress bonuses (only for above 1.5x wins)
    if win_type == 'above_1_5x':
        risk_bonus = risk_factor * 0.7  # Up to 70% bonus for high risk (increased)
        progress_bonus = progress_factor * 0.4  # Up to 40% bonus for progress (increased)
        final_multiplier = base_multiplier * (1 + risk_bonus + progress_bonus)
        # Cap at 6.0x maximum (increased due to higher risk)
        return min(final_multiplier, 6.0)
    else:
        return base_multiplier

# ================= MINESWEEPER LOGIC FUNCTIONS =================
def generate_mines(grid_size, mines_count, safe_cell=None):
    """Generate mines ensuring first clicked cell is safe if specified"""
    all_cells = [(r, c) for r in range(grid_size) for c in range(grid_size)]
    
    if safe_cell:
        # Ensure the safe cell is not a mine
        available_cells = [cell for cell in all_cells if cell != safe_cell]
        mines = random.sample(available_cells, mines_count)
    else:
        mines = random.sample(all_cells, mines_count)
    
    return mines

def count_adjacent_mines(row, col, mines_positions, grid_size):
    """Count how many mines are adjacent to a cell"""
    count = 0
    for dr in [-1, 0, 1]:
        for dc in [-1, 0, 1]:
            if dr == 0 and dc == 0:
                continue
            new_r, new_c = row + dr, col + dc
            if 0 <= new_r < grid_size and 0 <= new_c < grid_size:
                if (new_r, new_c) in mines_positions:
                    count += 1
    return count

def reveal_safe_cells(row, col, mines_positions, grid_size, already_revealed):
    """Reveal cells using standard minesweeper flood-fill algorithm"""
    to_reveal = []
    visited = set()
    
    # Use a stack for flood fill
    stack = [(row, col)]
    
    while stack:
        r, c = stack.pop()
        
        # Skip if already visited or out of bounds
        if (r, c) in visited or not (0 <= r < grid_size and 0 <= c < grid_size):
            continue
            
        visited.add((r, c))
        
        # If this is a mine, stop here
        if (r, c) in mines_positions:
            continue
            
        # Count adjacent mines
        adjacent_mines = count_adjacent_mines(r, c, mines_positions, grid_size)
        
        # Add to reveal list
        if [r, c] not in already_revealed:
            to_reveal.append([r, c])
        
        # If no adjacent mines, reveal surrounding cells
        if adjacent_mines == 0:
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    new_r, new_c = r + dr, c + dc
                    if (new_r, new_c) not in visited:
                        stack.append((new_r, new_c))
    
    return to_reveal

# ================= API VIEWS =================
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

        # Create game without mines (will generate on first click)
        game = MinesweeperGame.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            grid_size=grid_size,
            mines_count=mines_count,
            multiplier=Decimal("1.0"),
            status="playing",
            mines_positions=[],  # Empty for now, will generate on first click
        )

        return Response({
            "game_id": game.id,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "currency": "NGN",
            "message": f"Game started with {mines_count} mines on {grid_size}x{grid_size} grid",
            "warning": "⚠️ HIGH RISK: 75% chance of mine on first click!",
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

        # Generate mines on first click if not already generated
        if not game.mines_positions:
            # 25% chance first click is safe, 75% chance it's a mine (HIGH RISK)
            first_click_safe = random.random() < SAFE_CELL_CHANCE
            
            if first_click_safe:
                # Generate mines ensuring first click is safe (25% chance)
                mines = generate_mines(game.grid_size, game.mines_count, (row, col))
                logger.info(f"Game {game.id}: First click SAFE (25% chance) - Mines generated avoiding ({row}, {col})")
                
                # Save mines and mark first click as safe
                game.mines_positions = mines
                game.save()
                
                # Since this cell is guaranteed safe (not in mines), proceed to reveal
                # Get all cells to reveal using flood-fill algorithm
                revealed = game.revealed_cells or []
                cells_to_reveal = reveal_safe_cells(row, col, mines, game.grid_size, revealed)
                
                # Add newly revealed cells
                new_revealed_count = 0
                for cell in cells_to_reveal:
                    if cell not in revealed:
                        revealed.append(cell)
                        new_revealed_count += 1
                
                game.revealed_cells = revealed
                
                # Calculate multiplier
                total_safe = game.grid_size**2 - game.mines_count
                revealed_count = len(revealed)
                risk_factor = game.mines_count / (game.grid_size * game.grid_size)
                multiplier_increment = 0.15 + (risk_factor * 0.12)
                raw_multiplier = 1.0 + (revealed_count * multiplier_increment)
                game.multiplier = Decimal(str(min(round(raw_multiplier, 2), 15.0)))
                game.save()
                
                remaining_safe = total_safe - revealed_count
                
                return Response({
                    "hit_mine": False,
                    "revealed_cells": cells_to_reveal,
                    "all_revealed_cells": revealed,
                    "current_multiplier": float(game.multiplier),
                    "status": "playing",
                    "wallet_balance": float(wallet.balance),
                    "spot_balance": float(wallet.spot_balance),
                    "message": f"✅ LUCKY! First click SAFE (25% chance). Revealed {new_revealed_count} cell(s). Multiplier: {float(game.multiplier):.2f}x",
                    "safe_cells_left": remaining_safe,
                    "total_revealed": revealed_count,
                    "first_click_was_safe": True,
                    "first_click_was_mine": False,
                    "risk_level": "HIGH",
                    "warning": "⚠️ HIGH RISK: Next clicks still dangerous!",
                })
            else:
                # First click is a mine (75% chance - HIGH RISK)
                mines = generate_mines(game.grid_size, game.mines_count)
                logger.info(f"Game {game.id}: First click MINE (75% chance)")
                
                # Save mines
                game.mines_positions = mines
                
                # Check if clicked cell is actually a mine (it should be with 75% chance)
                if (row, col) in mines:
                    game.status = "lost"
                    game.win_amount = Decimal("0")
                    game.win_multiplier = Decimal("0.00")
                    
                    # Mark all mines as revealed for display
                    revealed_cells = game.revealed_cells or []
                    for mine_pos in mines:
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
                        "mines_positions": mines,
                        "revealed_cells": revealed_cells,
                        "win_amount": 0,
                        "win_multiplier": 0.0,
                        "wallet_balance": float(wallet.balance),
                        "spot_balance": float(wallet.spot_balance),
                        "message": "💥 MINE HIT! Game Over. (75% chance on first click)",
                        "first_click_was_mine": True,
                        "first_click_was_safe": False,
                        "risk_level": "HIGH",
                    })
                else:
                    # Rare edge case: random placed mines didn't include clicked cell
                    # Still treat as mine hit since 75% chance was rolled
                    game.status = "lost"
                    game.win_amount = Decimal("0")
                    game.win_multiplier = Decimal("0.00")
                    
                    # Add clicked cell to mines for display
                    mines.append((row, col))
                    game.mines_positions = mines
                    
                    # Mark all mines as revealed
                    revealed_cells = game.revealed_cells or []
                    for mine_pos in mines:
                        if list(mine_pos) not in revealed_cells:
                            revealed_cells.append(list(mine_pos))
                    game.revealed_cells = revealed_cells
                    
                    game.save()

                    stats, _ = MinesweeperStats.objects.get_or_create(user=request.user)
                    stats.total_games += 1
                    stats.save()

                    return Response({
                        "hit_mine": True,
                        "status": "lost",
                        "mines_positions": mines,
                        "revealed_cells": revealed_cells,
                        "win_amount": 0,
                        "win_multiplier": 0.0,
                        "wallet_balance": float(wallet.balance),
                        "spot_balance": float(wallet.spot_balance),
                        "message": "💥 MINE HIT! (Edge case - cell added to mines)",
                        "first_click_was_mine": True,
                        "first_click_was_safe": False,
                        "risk_level": "HIGH",
                    })
        
        # If we get here, mines were already generated (not first click)
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
                "message": "💥 MINE HIT! Game Over.",
                "first_click_was_mine": False,  # Not first click
                "first_click_was_safe": False,
                "risk_level": "HIGH",
            })

        # Cell is safe (not first click) - use minesweeper logic to reveal cells
        revealed = game.revealed_cells or []
        
        # Get all cells to reveal using flood-fill algorithm
        cells_to_reveal = reveal_safe_cells(row, col, game.mines_positions, game.grid_size, revealed)
        
        # Add newly revealed cells
        new_revealed_count = 0
        for cell in cells_to_reveal:
            if cell not in revealed:
                revealed.append(cell)
                new_revealed_count += 1
        
        game.revealed_cells = revealed

        # Calculate multiplier based on revealed cells
        total_safe = game.grid_size**2 - game.mines_count
        revealed_count = len(revealed)
        
        # Calculate multiplier
        risk_factor = game.mines_count / (game.grid_size * game.grid_size)
        multiplier_increment = 0.15 + (risk_factor * 0.12)
        raw_multiplier = 1.0 + (revealed_count * multiplier_increment)
        game.multiplier = Decimal(str(min(round(raw_multiplier, 2), 15.0)))
        
        game.save()

        # Calculate remaining safe cells
        remaining_safe = total_safe - revealed_count
        
        return Response({
            "hit_mine": False,
            "revealed_cells": cells_to_reveal,
            "all_revealed_cells": revealed,
            "current_multiplier": float(game.multiplier),
            "status": "playing",
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "message": f"✅ SAFE! Revealed {new_revealed_count} cell(s). Multiplier: {float(game.multiplier):.2f}x",
            "safe_cells_left": remaining_safe,
            "total_revealed": revealed_count,
            "first_click_was_safe": False,  # Not first click
            "first_click_was_mine": False,
            "risk_level": "HIGH",
            "warning": "⚠️ HIGH RISK: Still dangerous!",
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

        # Determine win type based on probabilities and progress
        revealed_count = len(game.revealed_cells or [])
        total_safe = game.grid_size**2 - game.mines_count
        
        # Calculate progress factor (0 to 1)
        progress_factor = revealed_count / total_safe if total_safe > 0 else 0
        
        # Determine win type: HIGHER WIN CHANCES DUE TO HIGHER RISK
        roll = random.random()
        
        # Higher chances due to higher risk gameplay
        above_1_5x_chance = ABOVE_1_5X_CHANCE * (0.4 + progress_factor * 0.6)  # 20% to 50%
        below_1_5x_chance = BELOW_1_5X_CHANCE * (0.6 + progress_factor * 0.4)  # 9% to 15%
        
        if roll < above_1_5x_chance:
            win_type = 'above_1_5x'
            is_loss = False
        elif roll < above_1_5x_chance + below_1_5x_chance:
            win_type = 'below_1_5x'
            is_loss = False
        else:
            win_type = None
            is_loss = True

        if is_loss:
            win_multiplier = Decimal("0.00")
            win_amount = Decimal("0.00")
            win_tier = "loss"
            win_message = "No win - better luck next time!"
        else:
            # Calculate win multiplier based on win type
            win_multiplier = get_minesweeper_multiplier(
                game.mines_count, 
                game.grid_size,
                revealed_count,
                win_type
            )
            
            # Ensure multiplier stays in correct range
            if win_type == 'above_1_5x':
                win_multiplier = max(1.51, win_multiplier)
                win_multiplier = min(win_multiplier, 6.0)  # Cap at 6.0x
            else:  # below_1_5x
                win_multiplier = max(0.5, win_multiplier)
                win_multiplier = min(win_multiplier, 1.49)
            
            # Calculate win amount
            win_amount = (game.bet_amount * Decimal(str(win_multiplier))).quantize(Decimal("0.01"))
            
            # Determine win tier for tracking
            if win_type == 'below_1_5x':
                win_tier = "small"
                win_message = f"Small win! {win_multiplier:.2f}x multiplier"
            elif win_multiplier <= 3.0:
                win_tier = "good"
                win_message = f"Good win! {win_multiplier:.2f}x multiplier"
            elif win_multiplier <= 5.0:
                win_tier = "great"
                win_message = f"Great win! {win_multiplier:.2f}x multiplier"
            else:
                win_tier = "perfect"
                win_message = f"PERFECT WIN! {win_multiplier:.2f}x multiplier"

        # Credit winnings to spot_balance
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["spot_balance"])

        game.status = "cashed_out"
        game.win_amount = win_amount
        game.win_multiplier = Decimal(str(win_multiplier))
        
        # Reveal all cells on cashout
        revealed_cells = game.revealed_cells or []
        all_cells = [(r, c) for r in range(game.grid_size) for c in range(game.grid_size)]
        
        for cell in all_cells:
            cell_list = list(cell)
            if cell_list not in revealed_cells:
                revealed_cells.append(cell_list)
        
        game.revealed_cells = revealed_cells
        game.save()

        stats, _ = MinesweeperStats.objects.get_or_create(user=request.user)
        stats.total_games += 1
        if win_amount > 0:
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
            "message": win_message,
            "revealed_cells": revealed_cells,
            "risk_level": "HIGH",
            "warning": "⚠️ HIGH RISK GAME - Thanks for playing!",
        })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_game_status(request, game_id):
    try:
        game = MinesweeperGame.objects.get(id=game_id, user=request.user)
        
        # Calculate safe cells left
        total_safe = game.grid_size**2 - game.mines_count
        revealed_count = len(game.revealed_cells or [])
        safe_cells_left = max(0, total_safe - revealed_count)
        
        # Determine if this was the first click (no mines generated yet)
        is_first_click = not game.mines_positions
        
        return Response({
            "game_id": game.id,
            "status": game.status,
            "multiplier": float(game.multiplier),
            "win_amount": float(game.win_amount),
            "win_multiplier": float(game.win_multiplier) if game.win_multiplier else 0,
            "revealed_cells": game.revealed_cells or [],
            "mines_positions": game.mines_positions or [],
            "mines_count": game.mines_count,
            "grid_size": game.grid_size,
            "safe_cells_left": safe_cells_left,
            "created_at": game.created_at.isoformat(),
            "is_first_click": is_first_click,
            "risk_level": "HIGH",
            "warning": "⚠️ HIGH RISK: 75% chance of mine on first click",
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
                'was_win': game.win_amount > 0,
                'risk_level': 'HIGH'
            })
        
        # Calculate best game
        best_game = MinesweeperGame.objects.filter(
            user=request.user,
            win_amount__gt=0
        ).order_by('-win_amount').first()
        
        best_game_info = None
        if best_game:
            best_game_info = {
                'win_amount': float(best_game.win_amount),
                'multiplier': float(best_game.win_multiplier),
                'bet_amount': float(best_game.bet_amount),
                'date': best_game.created_at.isoformat(),
                'risk_level': 'HIGH'
            }
        
        return Response({
            'total_games': total_games,
            'won_games': won_games,
            'win_rate': round(win_rate, 2),
            'total_won': round(total_won, 2),
            'avg_win': round(avg_win, 2),
            'highest_multiplier': float(stats.highest_multiplier),
            'best_game': best_game_info,
            'recent_games': recent_history,
            'game_type': 'HIGH RISK MINESWEEPER',
            'warning': '⚠️ HIGH RISK GAME: 75% chance of mine on first click',
            'first_click_stats': {
                'safe_chance': '25%',
                'mine_chance': '75%',
                'risk_level': 'VERY HIGH'
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting stats: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_game_info(request):
    """Get minesweeper game information"""
    return Response({
        'game_info': {
            'name': 'HIGH RISK Minesweeper',
            'description': 'EXTREME RISK VERSION! Reveal safe cells and avoid mines to win! 75% chance of hitting a mine on first click!',
            'minimum_bet': '100.00',
            'risk_level': 'VERY HIGH',
            'rules': [
                '75% chance of hitting a mine on first click!',
                'Higher risk = Higher potential rewards',
                'Reveal safe cells to increase your multiplier',
                'Avoid mines - hitting a mine ends the game',
                'Cash out anytime to secure your winnings',
                'More mines = higher risk = MUCH higher potential rewards',
            ],
            'warning': '⚠️ WARNING: This is a HIGH RISK version with 75% chance of mine on first click!'
        },
        'grid_sizes': [
            {'size': 5, 'cells': 25, 'description': 'Small (5x5)', 'recommended_mines': '3-5'},
            {'size': 6, 'cells': 36, 'description': 'Medium (6x6)', 'recommended_mines': '5-7'},
            {'size': 7, 'cells': 49, 'description': 'Large (7x7)', 'recommended_mines': '7-10'},
            {'size': 8, 'cells': 64, 'description': 'Extra Large (8x8)', 'recommended_mines': '10-15'},
        ],
        'mine_settings': [
            {'mines': 3, 'risk': 'Medium', 'description': 'Medium risk, good for beginners'},
            {'mines': 5, 'risk': 'High', 'description': 'High risk, balanced gameplay'},
            {'mines': 7, 'risk': 'Very High', 'description': 'Very high risk, challenging'},
            {'mines': 10, 'risk': 'Extreme', 'description': 'Extreme risk, expert only'},
        ],
        'strategy_tips': [
            '⚠️ WARNING: 75% chance of mine on first click!',
            'Start with smaller bets to understand the risk',
            'Cash out EARLY to secure ANY win',
            'Each safe cell significantly increases your multiplier',
            'More mines = MUCH higher risk but MUCH higher potential rewards',
            'Consider this as a HIGH RISK gambling game',
        ],
        'probabilities': {
            'first_click_safe': '25% (LOW)',
            'first_click_mine': '75% (HIGH)',
            'win_above_1.5x': 'Up to 50%',
            'win_below_1.5x': 'Up to 15%',
            'loss': 'Up to 35%',
            'risk_level': 'VERY HIGH',
        },
        'multiplier_range': {
            'small_wins': '0.5x - 1.49x',
            'good_wins': '1.6x - 3.5x',
            'great_wins': '3.6x - 5.0x',
            'perfect_wins': '5.1x - 6.0x (MAX)',
            'note': 'Higher multipliers due to increased risk'
        }
    })