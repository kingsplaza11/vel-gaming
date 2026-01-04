import random
from decimal import Decimal, ROUND_DOWN
from decimal import InvalidOperation
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from wallets.models import Wallet
from .models import FishingSession, FishingStats
from accounts.models import User

# Base fish data - Updated with 0.5x to 3.5x multipliers
FISH_TYPES = {
    'common': [
        {'name': 'Sardine', 'multiplier': 0.5, 'emoji': '🐟', 'rarity': 'Common'},
        {'name': 'Mackerel', 'multiplier': 0.75, 'emoji': '🐠', 'rarity': 'Common'},
        {'name': 'Bass', 'multiplier': 1.0, 'emoji': '🎣', 'rarity': 'Common'},
        {'name': 'Herring', 'multiplier': 1.25, 'emoji': '🐡', 'rarity': 'Common'},
        {'name': 'Anchovy', 'multiplier': 1.5, 'emoji': '🐟', 'rarity': 'Common'},
    ],
    'uncommon': [
        {'name': 'Tilapia', 'multiplier': 1.75, 'emoji': '🐠', 'rarity': 'Uncommon'},
        {'name': 'Snapper', 'multiplier': 2.0, 'emoji': '🎣', 'rarity': 'Uncommon'},
        {'name': 'Catfish', 'multiplier': 2.25, 'emoji': '🐡', 'rarity': 'Uncommon'},
        {'name': 'Perch', 'multiplier': 2.5, 'emoji': '🐟', 'rarity': 'Uncommon'},
    ],
    'rare': [
        {'name': 'Tuna', 'multiplier': 2.75, 'emoji': '🐟', 'rarity': 'Rare'},
        {'name': 'Salmon', 'multiplier': 3.0, 'emoji': '🐠', 'rarity': 'Rare'},
        {'name': 'Mahi Mahi', 'multiplier': 3.25, 'emoji': '🎣', 'rarity': 'Rare'},
        {'name': 'Grouper', 'multiplier': 3.5, 'emoji': '🐡', 'rarity': 'Rare'},
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

WRONG_TREASURES = ["Rusty Boot", "Sea Bomb", "Cursed Skull", "Old Tire", "Seaweed Bundle"]

def _choose_fish():
    roll = random.random()
    
    # 70% chance of catching a fish (winning)
    if roll < 0.70:
        # Weight distribution for different rarities
        rarity_roll = random.random()
        
        if rarity_roll < 0.50:  # 50% of wins = Common fish (35% overall)
            fish_list = FISH_TYPES["common"]
            weights = [0.20, 0.20, 0.20, 0.20, 0.20]  # Equal weights for common fish
        elif rarity_roll < 0.80:  # 30% of wins = Uncommon fish (21% overall)
            fish_list = FISH_TYPES["uncommon"]
            weights = [0.25, 0.25, 0.25, 0.25]  # Equal weights for uncommon fish
        else:  # 20% of wins = Rare fish (14% overall)
            fish_list = FISH_TYPES["rare"]
            weights = [0.25, 0.25, 0.25, 0.25]  # Equal weights for rare fish
        
        base = random.choices(fish_list, weights=weights, k=1)[0]
        
        # Apply random size multiplier
        size = random.choice(SIZES)
        final_multiplier = base["multiplier"] * size["size_multiplier"]
        
        # Ensure multiplier stays between 0.5x and 3.5x
        final_multiplier = max(0.5, min(3.5, final_multiplier))
        
        return {
            "name": base["name"],
            "rarity": base["rarity"],
            "emoji": base["emoji"],
            "multiplier": float(final_multiplier),
            "is_trap": False,
            "size": size["label"],
            "size_multiplier": size["size_multiplier"],
        }
    else:
        # 30% chance of trap (loss)
        trap_type = random.choice(WRONG_TREASURES)
        
        # Assign different trap emojis
        trap_emojis = {
            "Rusty Boot": "👢",
            "Sea Bomb": "💣", 
            "Cursed Skull": "💀",
            "Old Tire": "🛞",
            "Seaweed Bundle": "🌿"
        }
        
        return {
            "name": trap_type,
            "rarity": "Trap",
            "emoji": trap_emojis.get(trap_type, "💀"),
            "multiplier": 0.0,
            "is_trap": True,
            "size": "N/A",
            "size_multiplier": 1.0,
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

        # Check combined balance first
        combined_balance = wallet.balance + wallet.spot_balance
        
        if combined_balance < bet_amount:
            return Response({'error': 'Insufficient balance'}, status=400)

        remaining_cost = bet_amount
        taken_from_wallet = Decimal('0')
        taken_from_spot = Decimal('0')

        # Deduct stake from main balance first
        if wallet.balance > 0:
            taken_from_wallet = min(wallet.balance, remaining_cost)
            wallet.balance -= taken_from_wallet
            remaining_cost -= taken_from_wallet

        # If still remaining, deduct from spot balance
        if remaining_cost > 0 and wallet.spot_balance > 0:
            taken_from_spot = min(wallet.spot_balance, remaining_cost)
            wallet.spot_balance -= taken_from_spot
            remaining_cost -= taken_from_spot

        # Get the fish catch
        catch = _choose_fish()

        # Calculate win amount
        if catch["is_trap"]:
            win_amount = Decimal("0.00")
        else:
            # Apply the multiplier to the bet
            win_amount = bet_amount * Decimal(str(catch["multiplier"]))
            win_amount = win_amount.quantize(Decimal("0.01"))
        
        # Calculate profit/loss
        profit = win_amount - bet_amount
        
        # Add winnings to spot balance
        wallet.spot_balance += win_amount
        wallet.save(update_fields=["balance", "spot_balance"])

        # Create fishing session record
        FishingSession.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            win_amount=win_amount,
            catch_result=catch,
        )

        return Response({
            "catch": catch,
            "bet_amount": float(bet_amount),
            "win_amount": float(win_amount),
            "profit": float(profit),
            "new_balance": float(wallet.balance),
            "new_spot_balance": float(wallet.spot_balance),
            "chance_info": {
                "win_chance": "70%",
                "multiplier_range": "0.5x - 3.5x",
                "trap_chance": "30%"
            }
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
        
        # Calculate win rate
        total_wins = FishingSession.objects.filter(
            user=request.user, 
            win_amount__gt=0
        ).count()
        win_rate = (total_wins / total_sessions * 100) if total_sessions > 0 else 0.0

        return Response({
            'total_sessions': total_sessions,
            'total_won': round(total_won, 2),
            'biggest_catch': biggest_catch,
            'avg_win_per_session': round(avg_win_per_session, 2),
            'win_rate': round(win_rate, 1),
            'fishing_level': calculate_fishing_level(total_sessions),
            'game_info': {
                'win_chance': '70%',
                'multiplier_range': '0.5x - 3.5x',
                'trap_chance': '30%'
            }
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
                'result_type': 'WIN' if session.win_amount > 0 else 'LOSS',
            })

        return Response({
            'history': history,
            'total_count': len(history),
            'summary': {
                'total_bet': sum(float(s.bet_amount) for s in sessions),
                'total_win': sum(float(s.win_amount) for s in sessions),
                'total_profit': sum(float(s.win_amount - s.bet_amount) for s in sessions),
            }
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_fishing_info(request):
    """
    Get detailed fishing game information and probabilities
    """
    try:
        return Response({
            'game_info': {
                'name': 'Fishing Game',
                'description': 'Cast your line and catch fish for multipliers!',
                'win_chance': '70%',
                'trap_chance': '30%',
                'multiplier_range': '0.5x - 3.5x',
                'minimum_bet': '10.00',
            },
            'fish_types': [
                {
                    'rarity': 'Common',
                    'multipliers': ['0.5x', '0.75x', '1.0x', '1.25x', '1.5x'],
                    'chance_of_win': '35%',
                    'description': 'Basic fish with small multipliers'
                },
                {
                    'rarity': 'Uncommon',
                    'multipliers': ['1.75x', '2.0x', '2.25x', '2.5x'],
                    'chance_of_win': '21%',
                    'description': 'Better fish with moderate multipliers'
                },
                {
                    'rarity': 'Rare',
                    'multipliers': ['2.75x', '3.0x', '3.25x', '3.5x'],
                    'chance_of_win': '14%',
                    'description': 'Rare fish with high multipliers'
                },
                {
                    'rarity': 'Trap',
                    'multipliers': ['0x'],
                    'chance': '30%',
                    'description': 'Bad catches that result in loss'
                }
            ],
            'sizes': SIZES,
            'size_effect': 'Fish size multiplies the base multiplier (0.6x to 1.5x)',
            'expected_rtp': '97%',  # Expected Return to Player
            'house_edge': '3%',
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)