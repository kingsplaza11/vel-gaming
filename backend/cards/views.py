import random
from decimal import Decimal

from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import CardGame, CardStats
from accounts.models import User
from wallets.models import Wallet  # ✅ ensure correct import

MIN_BET = Decimal("500.00")

def create_card_deck(grid_size):
    pairs_count = grid_size // 2
    cards = list(range(1, pairs_count + 1)) * 2
    random.shuffle(cards)
    return cards


@api_view(['POST'])
def start_card_game(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        grid_size = int(request.data.get('grid_size', 16))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=400)

    if bet_amount < MIN_BET:
        return Response({'error': 'Minimum stake is ₦500'}, status=400)

    if grid_size % 2 != 0 or grid_size < 4:
        return Response({'error': 'Invalid grid size'}, status=400)

    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            wallet = Wallet.objects.select_for_update().get(user=user)

            if wallet.balance < bet_amount:
                return Response({'error': 'Insufficient wallet balance'}, status=400)

            # Deduct stake
            wallet.balance -= bet_amount
            wallet.save()

            cards = create_card_deck(grid_size)

            game = CardGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                grid_size=grid_size,
                cards=cards,
                attempts=0,
                matches_found=0,
                multiplier=Decimal('1.00'),
                status='playing'
            )

            return Response({
                'game_id': game.id,
                'grid_size': grid_size,
                'cards_count': len(cards),
                'new_balance': float(wallet.balance)
            })

    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
def reveal_card(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    try:
        game_id = int(request.data.get('game_id'))
        card_index = int(request.data.get('card_index'))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=400)

    try:
        with transaction.atomic():
            game = CardGame.objects.select_for_update().get(
                id=game_id,
                user=request.user,
                status='playing'
            )

            cards = game.cards
            revealed = game.revealed_cards or []

            if card_index < 0 or card_index >= len(cards):
                return Response({'error': 'Invalid card index'}, status=400)

            if card_index in revealed:
                return Response({'error': 'Card already revealed'}, status=400)

            revealed.append(card_index)
            game.revealed_cards = revealed

            # FIRST PICK
            if len(revealed) % 2 == 1:
                game.save()
                return Response({
                    'card_value': cards[card_index],
                    'match_found': None,
                    'status': 'playing'
                })

            # SECOND PICK
            last_two = revealed[-2:]
            game.attempts += 1

            # MATCH
            if cards[last_two[0]] == cards[last_two[1]]:
                game.matches_found += 1

                total_pairs = len(cards) // 2
                game.multiplier = Decimal('1.00') + (
                    Decimal(game.matches_found) / Decimal(total_pairs)
                ) * Decimal('4.00')

                # COMPLETE GAME
                if game.matches_found >= total_pairs:
                    wallet = Wallet.objects.select_for_update().get(user=request.user)
                    win_amount = game.bet_amount * game.multiplier

                    wallet.balance += win_amount
                    wallet.save()

                    game.status = 'completed'
                    game.win_amount = win_amount
                    game.save()

                    stats, _ = CardStats.objects.get_or_create(user=request.user)
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
                        'new_balance': float(wallet.balance)
                    })

                game.save()
                return Response({
                    'card_value': cards[card_index],
                    'match_found': True,
                    'matches_found': game.matches_found,
                    'multiplier': float(game.multiplier),
                    'status': 'playing'
                })

            # NO MATCH
            if game.attempts >= 2:
                game.status = 'failed'
                game.save()
                return Response({
                    'card_value': cards[card_index],
                    'match_found': False,
                    'status': 'failed'
                })

            game.save()
            return Response({
                'card_value': cards[card_index],
                'match_found': False,
                'status': 'playing'
            })

    except CardGame.DoesNotExist:
        return Response({'error': 'Game not found or finished'}, status=400)


@api_view(['GET'])
def get_card_stats(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    stats, _ = CardStats.objects.get_or_create(user=request.user)

    return Response({
        'total_games': stats.total_games,
        'total_won': float(stats.total_won),
        'avg_win_per_game': float(stats.total_won / stats.total_games) if stats.total_games else 0,
        'success_rate': calculate_success_rate(request.user)
    })


@api_view(['GET'])
def get_card_history(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    games = CardGame.objects.filter(user=request.user).order_by('-created_at')[:10]

    return Response({
        'history': [
            {
                'id': g.id,
                'bet_amount': float(g.bet_amount),
                'win_amount': float(g.win_amount),
                'grid_size': g.grid_size,
                'matches_found': g.matches_found,
                'multiplier': float(g.multiplier),
                'status': g.status,
                'created_at': g.created_at.isoformat()
            }
            for g in games
        ]
    })


def calculate_success_rate(user):
    total = CardGame.objects.filter(user=user).count()
    wins = CardGame.objects.filter(user=user, status='completed').count()
    return (wins / total * 100) if total else 0
