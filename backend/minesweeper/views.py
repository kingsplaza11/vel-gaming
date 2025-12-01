import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import MinesweeperGame, MinesweeperStats
from accounts.models import User

@api_view(['POST'])
def start_minesweeper(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        grid_size = int(request.data.get('grid_size', 5))
        mines_count = int(request.data.get('mines_count', 5))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if mines_count >= grid_size * grid_size:
        return Response({'error': 'Too many mines for grid size'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Create minesweeper game
            game = MinesweeperGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                grid_size=grid_size,
                mines_count=mines_count
            )
            
            return Response({
                'game_id': game.id,
                'grid_size': grid_size,
                'mines_count': mines_count,
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def reveal_cell(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
        row = int(request.data.get('row'))
        col = int(request.data.get('col'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = MinesweeperGame.objects.get(id=game_id, user=user, status='playing')
            
            # Generate mines if not already done (first move)
            if not hasattr(game, 'mines_positions'):
                # Ensure first click is safe
                safe_cells = [(r, c) for r in range(game.grid_size) for c in range(game.grid_size)]
                safe_cells.remove((row, col))
                
                # Place mines randomly
                mines_positions = random.sample(safe_cells, game.mines_count)
                game.mines_positions = mines_positions
                game.save()
            
            # Check if hit mine
            if (row, col) in game.mines_positions:
                game.status = 'lost'
                game.win_amount = Decimal('0')
                game.save()
                
                # Update stats
                stats, created = MinesweeperStats.objects.get_or_create(user=user)
                stats.total_games += 1
                stats.save()
                
                return Response({
                    'hit_mine': True,
                    'mines_positions': game.mines_positions,
                    'status': 'lost',
                    'win_amount': 0,
                    'new_balance': float(user.balance)
                })
            
            # Add to revealed cells
            revealed = game.revealed_cells or []
            if (row, col) not in revealed:
                revealed.append((row, col))
                game.revealed_cells = revealed
            
            # Calculate current multiplier (based on revealed safe cells)
            total_safe_cells = game.grid_size * game.grid_size - game.mines_count
            current_multiplier = Decimal(len(revealed)) / Decimal(total_safe_cells) * Decimal('10') + Decimal('1')
            game.multiplier = current_multiplier
            game.save()
            
            # Check if won (all safe cells revealed)
            if len(revealed) >= total_safe_cells:
                game.status = 'won'
                win_amount = game.bet_amount * current_multiplier
                game.win_amount = win_amount
                
                # Add winnings
                user.balance += win_amount
                user.save()
                game.save()
                
                # Update stats
                stats, created = MinesweeperStats.objects.get_or_create(user=user)
                stats.total_games += 1
                stats.total_won += win_amount
                if current_multiplier > stats.highest_multiplier:
                    stats.highest_multiplier = current_multiplier
                stats.save()
                
                return Response({
                    'hit_mine': False,
                    'revealed_cells': revealed,
                    'multiplier': float(current_multiplier),
                    'status': 'won',
                    'win_amount': float(win_amount),
                    'new_balance': float(user.balance)
                })
            
            return Response({
                'hit_mine': False,
                'revealed_cells': revealed,
                'multiplier': float(current_multiplier),
                'status': 'playing',
                'mines_remaining': game.mines_count
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def cash_out(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = MinesweeperGame.objects.get(id=game_id, user=user, status='playing')
            
            # Calculate win amount
            win_amount = game.bet_amount * game.multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            game.status = 'cashed_out'
            game.win_amount = win_amount
            game.save()
            
            # Update stats
            stats, created = MinesweeperStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_won += win_amount
            if game.multiplier > stats.highest_multiplier:
                stats.highest_multiplier = game.multiplier
            stats.save()
            
            return Response({
                'win_amount': float(win_amount),
                'multiplier': float(game.multiplier),
                'new_balance': float(user.balance),
                'revealed_cells': len(game.revealed_cells)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_minesweeper_stats(request):
    """
    Get minesweeper statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        stats, created = MinesweeperStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_games = stats.total_games
        total_won = float(stats.total_won) if stats.total_won else 0
        highest_multiplier = float(stats.highest_multiplier) if stats.highest_multiplier else 0
        
        # Calculate win rate
        win_rate = (stats.total_won / stats.bet_amount * 100) if stats.total_games > 0 and stats.bet_amount > 0 else 0
        
        return Response({
            'total_games': total_games,
            'total_won': total_won,
            'highest_multiplier': highest_multiplier,
            'win_rate': round(win_rate, 2),
            'player_level': calculate_player_level(total_games)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_minesweeper_history(request):
    """
    Get recent minesweeper history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 games, most recent first
        games = MinesweeperGame.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for game in games:
            history.append({
                'id': game.id,
                'bet_amount': float(game.bet_amount),
                'win_amount': float(game.win_amount),
                'grid_size': game.grid_size,
                'mines_count': game.mines_count,
                'multiplier': float(game.multiplier),
                'status': game.status,
                'created_at': game.created_at.isoformat(),
                'profit': float(game.win_amount - game.bet_amount)
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_player_level(total_games):
    """
    Calculate player level based on total games played
    """
    if total_games >= 100:
        return "Mine Master 💎"
    elif total_games >= 50:
        return "Expert Demolition 💣"
    elif total_games >= 25:
        return "Seasoned Sweeper 🎯"
    elif total_games >= 10:
        return "Amateur Miner ⛏️"
    else:
        return "Novice Explorer 🧭"