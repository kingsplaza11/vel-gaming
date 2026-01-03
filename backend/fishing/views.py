import random
from decimal import Decimal, ROUND_DOWN
from decimal import InvalidOperation
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from wallets.models import Wallet  # ✅ ADD THIS
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


MAX_WIN_RATIO = Decimal("0.48")  # 30%

WRONG_TREASURES = ["Rusty Boot", "Sea Bomb", "Cursed Skull"]

def _choose_fish():
    # 30% chance of trap → full loss
    if random.random() < 0.48:
        return {
            "name": random.choice(WRONG_TREASURES),
            "rarity": "Trap",
            "emoji": "💀",
            "multiplier": 0.0,      # ✅ FLOAT
            "is_trap": True,
        }

    base = random.choice(
        FISH_TYPES["common"] +
        FISH_TYPES["rare"] +
        FISH_TYPES["epic"]
    )

    return {
        "name": base["name"],
        "rarity": base["rarity"],
        "emoji": base["emoji"],
        "multiplier": float(base["multiplier"]),  # ✅ FLOAT
        "is_trap": False,
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cast_line(request):
    try:
        bet_amount = Decimal(str(request.data.get("bet_amount", 0)))
    except Exception:
        return Response({"error": "Invalid bet"}, status=400)

    if bet_amount <= 0:
        return Response({"error": "Invalid bet"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        if wallet.balance < bet_amount:
            return Response({"error": "Insufficient wallet balance"}, status=400)

        # Deduct stake
        wallet.balance -= bet_amount

        catch = _choose_fish()

        if catch["is_trap"]:
            win_amount = Decimal("0.00")
        else:
            raw_win = bet_amount * Decimal(str(catch["multiplier"]))
            max_allowed = (bet_amount * MAX_WIN_RATIO).quantize(Decimal("0.01"))
            win_amount = min(raw_win, max_allowed)

        wallet.spot_balance += win_amount
        wallet.save(update_fields=["balance"])

        FishingSession.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            win_amount=win_amount,
            catch_result=catch,  # ✅ NOW JSON SAFE
        )

        return Response({
            "catch": catch,
            "bet_amount": float(bet_amount),
            "win_amount": float(win_amount),
            "profit": float(win_amount - bet_amount),
            "new_balance": float(wallet.balance),
        })


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
