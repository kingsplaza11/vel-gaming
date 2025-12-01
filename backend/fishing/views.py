import random
from decimal import Decimal, ROUND_DOWN
from decimal import InvalidOperation
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from .models import FishingSession, FishingStats
from accounts.models import User

# Base fish data
FISH_TYPES = {
    'common': [
        {'name': 'Sardine', 'multiplier': 1.2, 'emoji': '🐟', 'rarity': 'Common'},
        {'name': 'Mackerel', 'multiplier': 1.5, 'emoji': '🐠', 'rarity': 'Common'},
        {'name': 'Bass', 'multiplier': 1.8, 'emoji': '🎣', 'rarity': 'Common'},
    ],
    'rare': [
        {'name': 'Tuna', 'multiplier': 3.0, 'emoji': '🐟', 'rarity': 'Rare'},
        {'name': 'Salmon', 'multiplier': 4.0, 'emoji': '🐠', 'rarity': 'Rare'},
        {'name': 'Mahi Mahi', 'multiplier': 5.0, 'emoji': '🎣', 'rarity': 'Rare'},
    ],
    'epic': [
        {'name': 'Swordfish', 'multiplier': 8.0, 'emoji': '🐟', 'rarity': 'Epic'},
        {'name': 'Marlin', 'multiplier': 12.0, 'emoji': '🐠', 'rarity': 'Epic'},
        {'name': 'Bluefin Tuna', 'multiplier': 15.0, 'emoji': '🎣', 'rarity': 'Epic'},
    ],
    'legendary': [
        {'name': 'Golden Fish', 'multiplier': 25.0, 'emoji': '🌟', 'rarity': 'Legendary'},
        {'name': 'Mystic Koi', 'multiplier': 50.0, 'emoji': '🔮', 'rarity': 'Legendary'},
        {'name': 'Leviathan', 'multiplier': 100.0, 'emoji': '🐉', 'rarity': 'Legendary'},
    ],
}

SIZES = [
    {"label": "Tiny", "size_multiplier": 0.6},
    {"label": "Small", "size_multiplier": 0.8},
    {"label": "Medium", "size_multiplier": 1.0},
    {"label": "Large", "size_multiplier": 1.2},
    {"label": "Giant", "size_multiplier": 1.5},
]


def _choose_fish():
    """
    Decide which rarity bucket to use, then pick a random fish and random size.
    Returns a full catch dict.
    """
    rand = random.random()
    # Rarity probabilities
    # 50% common, 30% rare, 15% epic, 5% legendary
    if rand < 0.50:
        fish_pool = FISH_TYPES['common']
        rarity_label = "Common"
    elif rand < 0.80:
        fish_pool = FISH_TYPES['rare']
        rarity_label = "Rare"
    elif rand < 0.95:
        fish_pool = FISH_TYPES['epic']
        rarity_label = "Epic"
    else:
        fish_pool = FISH_TYPES['legendary']
        rarity_label = "Legendary"

    base_fish = random.choice(fish_pool)
    size = random.choice(SIZES)

    base_multiplier = Decimal(str(base_fish['multiplier']))
    size_multiplier = Decimal(str(size["size_multiplier"]))
    total_multiplier = (base_multiplier * size_multiplier).quantize(Decimal("0.01"), rounding=ROUND_DOWN)

    return {
        "name": base_fish["name"],
        "rarity": rarity_label,
        "emoji": base_fish["emoji"],
        "base_multiplier": float(base_multiplier),
        "size": size["label"],
        "size_multiplier": float(size_multiplier),
        "multiplier": float(total_multiplier),
    }


def calculate_fishing_level(total_sessions: int) -> str:
    """
    Calculate fishing level based on total sessions
    """
    if total_sessions >= 100:
        return "Master Angler 🎯"
    elif total_sessions >= 50:
        return "Expert Fisher 🎣"
    elif total_sessions >= 25:
        return "Seasoned Angler 🐠"
    elif total_sessions >= 10:
        return "Amateur Fisher 🎏"
    else:
        return "Novice Angler 🐟"


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cast_line(request):
    """
    Core game endpoint – deduct bet, simulate catch, pay out winnings,
    store session + stats, and return the result.
    """
    try:
        bet_amount_raw = request.data.get('bet_amount', 10)
        bet_amount = Decimal(str(bet_amount_raw))
    except (TypeError, ValueError, InvalidOperation):
        return Response({'error': 'Invalid bet amount'}, status=status.HTTP_400_BAD_REQUEST)

    if bet_amount <= 0:
        return Response({'error': 'Bet amount must be greater than 0'}, status=status.HTTP_400_BAD_REQUEST)

    MIN_BET = Decimal("1.00")
    MAX_BET = Decimal("1000.00")

    if bet_amount < MIN_BET:
        return Response({'error': f'Minimum bet is {MIN_BET}'}, status=status.HTTP_400_BAD_REQUEST)

    if bet_amount > MAX_BET:
        return Response({'error': f'Maximum bet is {MAX_BET}'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)

            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)

            # Deduct bet amount
            user.balance -= bet_amount

            # Decide the catch
            catch = _choose_fish()
            multiplier = Decimal(str(catch['multiplier']))

            win_amount = (bet_amount * multiplier).quantize(Decimal("0.01"), rounding=ROUND_DOWN)

            # Add winnings
            user.balance += win_amount
            user.save(update_fields=['balance'])

            # Persist session
            session = FishingSession.objects.create(
                user=user,
                bet_amount=bet_amount,
                catch_result=catch,
                win_amount=win_amount,
            )

            # Update stats
            stats, created = FishingStats.objects.get_or_create(user=user)
            stats.total_sessions += 1
            stats.total_won += win_amount

            # Update biggest catch if this multiplier is better
            current_best_multiplier = 0.0
            if stats.biggest_catch:
                try:
                    current_best_multiplier = float(stats.biggest_catch.split('x')[0])
                except Exception:
                    current_best_multiplier = 0.0

            if multiplier > Decimal(str(current_best_multiplier)):
                stats.biggest_catch = f"{catch['multiplier']}x {catch['name']} ({catch['rarity']})"

            stats.save(update_fields=['total_sessions', 'total_won', 'biggest_catch'])

            return Response({
                'catch': catch,
                'bet_amount': float(bet_amount),
                'win_amount': float(win_amount),
                'profit': float(win_amount - bet_amount),
                'new_balance': float(user.balance),
                'session_id': session.id,
            }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_fishing_stats(request):
    """
    Get fishing statistics for the authenticated user
    """
    try:
        stats, created = FishingStats.objects.get_or_create(user=request.user)

        total_sessions = stats.total_sessions
        total_won = float(stats.total_won) if stats.total_won else 0.0
        biggest_catch = stats.biggest_catch or "No catches yet"

        avg_win_per_session = total_won / total_sessions if total_sessions > 0 else 0.0

        return Response({
            'total_sessions': total_sessions,
            'total_won': round(total_won, 2),
            'biggest_catch': biggest_catch,
            'avg_win_per_session': round(avg_win_per_session, 2),
            'fishing_level': calculate_fishing_level(total_sessions),
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_fishing_history(request):
    """
    Get recent fishing history for the authenticated user
    """
    try:
        sessions = FishingSession.objects.filter(user=request.user).order_by('-created_at')[:20]

        history = []
        for session in sessions:
            history.append({
                'id': session.id,
                'bet_amount': float(session.bet_amount),
                'win_amount': float(session.win_amount),
                'catch_result': session.catch_result,
                'created_at': session.created_at.isoformat(),
                'profit': float(session.win_amount - session.bet_amount),
            })

        return Response({
            'history': history,
            'total_count': len(history),
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
