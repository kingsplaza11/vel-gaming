import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import CardGame, CardStats
from accounts.models import User

def create_card_deck(grid_size):
    """Create a matching pairs card deck"""
    pairs_count = grid_size // 2
    cards = list(range(1, pairs_count + 1)) * 2
    random.shuffle(cards)
    return cards

@api_view(['POST'])
def start_card_game(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        grid_size = int(request.data.get('grid_size', 16))  # 4x4 grid
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if grid_size % 2 != 0:
        return Response({'error': 'Grid size must be even'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Create card deck
            cards = create_card_deck(grid_size)
            
            # Create card game
            game = CardGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                grid_size=grid_size,
                cards=cards
            )
            
            return Response({
                'game_id': game.id,
                'grid_size': grid_size,
                'cards_count': len(cards),
                'new_balance': float(user.balance)
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def reveal_card(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        game_id = request.data.get('game_id')
        card_index = int(request.data.get('card_index'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            game = CardGame.objects.get(id=game_id, user=user, status='playing')
            
            revealed = game.revealed_cards or []
            cards = game.cards
            
            # Check if card already revealed
            if card_index in revealed:
                return Response({'error': 'Card already revealed'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Reveal card
            revealed.append(card_index)
            game.revealed_cards = revealed
            
            # Check for matches (every two cards)
            if len(revealed) % 2 == 0:
                last_two = revealed[-2:]
                card1 = cards[last_two[0]]
                card2 = cards[last_two[1]]
                
                if card1 == card2:
                    # Match found
                    game.matches_found += 1
                    
                    # Update multiplier
                    total_pairs = len(cards) // 2
                    game.multiplier = Decimal('1') + (Decimal(str(game.matches_found)) / Decimal(str(total_pairs))) * Decimal('5')
                    game.save()
                    
                    # Check if game completed
                    if game.matches_found >= total_pairs:
                        game.status = 'completed'
                        win_amount = game.bet_amount * game.multiplier
                        game.win_amount = win_amount
                        
                        # Add winnings
                        user.balance += win_amount
                        user.save()
                        game.save()
                        
                        # Update stats
                        stats, created = CardStats.objects.get_or_create(user=user)
                        stats.total_games += 1
                        stats.total_won += win_amount
                        stats.save()
                        
                        return Response({
                            'card_value': cards[card_index],
                            'match_found': True,
                            'matches_found': game.matches_found,
                            'multiplier': float(game.multiplier),
                            'status': 'completed',
                            'win_amount': float(win_amount),
                            'new_balance': float(user.balance)
                        })
                    
                    return Response({
                        'card_value': cards[card_index],
                        'match_found': True,
                        'matches_found': game.matches_found,
                        'multiplier': float(game.multiplier),
                        'status': 'playing'
                    })
                else:
                    # No match - cards will be hidden again
                    # But we keep them revealed for the client to handle
                    game.save()
                    return Response({
                        'card_value': cards[card_index],
                        'match_found': False,
                        'matches_found': game.matches_found,
                        'status': 'playing'
                    })
            else:
                # First card of pair
                game.save()
                return Response({
                    'card_value': cards[card_index],
                    'match_found': None,
                    'status': 'playing'
                })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_card_stats(request):
    """
    Get card game statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        stats, created = CardStats.objects.get_or_create(user=request.user)
        
        return Response({
            'total_games': stats.total_games,
            'total_won': float(stats.total_won),
            'fastest_time': stats.fastest_time,
            'avg_win_per_game': float(stats.total_won / stats.total_games) if stats.total_games > 0 else 0,
            'success_rate': calculate_success_rate(request.user)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_card_history(request):
    """
    Get recent card game history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        games = CardGame.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for game in games:
            history.append({
                'id': game.id,
                'bet_amount': float(game.bet_amount),
                'win_amount': float(game.win_amount),
                'grid_size': game.grid_size,
                'matches_found': game.matches_found,
                'multiplier': float(game.multiplier),
                'status': game.status,
                'created_at': game.created_at.isoformat()
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_success_rate(user):
    """
    Calculate success rate based on completed games
    """
    total_games = CardGame.objects.filter(user=user).count()
    completed_games = CardGame.objects.filter(user=user, status='completed').count()
    
    if total_games == 0:
        return 0
    return (completed_games / total_games) * 100