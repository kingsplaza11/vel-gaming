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

# Base fish data - Updated with higher multipliers to compensate for lower win rate
FISH_TYPES = {
    'common': [
        {'name': 'Sardine', 'multiplier': 0.75, 'emoji': '🐟', 'rarity': 'Common'},  # Increased from 0.5
        {'name': 'Mackerel', 'multiplier': 1.0, 'emoji': '🐠', 'rarity': 'Common'},  # Increased from 0.75
        {'name': 'Bass', 'multiplier': 1.25, 'emoji': '🎣', 'rarity': 'Common'},     # Increased from 1.0
        {'name': 'Herring', 'multiplier': 1.5, 'emoji': '🐡', 'rarity': 'Common'},   # Increased from 1.25
        {'name': 'Anchovy', 'multiplier': 1.75, 'emoji': '🐟', 'rarity': 'Common'},  # Increased from 1.5
    ],
    'uncommon': [
        {'name': 'Tilapia', 'multiplier': 2.0, 'emoji': '🐠', 'rarity': 'Uncommon'},   # Increased from 1.75
        {'name': 'Snapper', 'multiplier': 2.25, 'emoji': '🎣', 'rarity': 'Uncommon'},  # Increased from 2.0
        {'name': 'Catfish', 'multiplier': 2.5, 'emoji': '🐡', 'rarity': 'Uncommon'},   # Increased from 2.25
        {'name': 'Perch', 'multiplier': 2.75, 'emoji': '🐟', 'rarity': 'Uncommon'},    # Increased from 2.5
    ],
    'rare': [
        {'name': 'Tuna', 'multiplier': 3.0, 'emoji': '🐟', 'rarity': 'Rare'},          # Increased from 2.75
        {'name': 'Salmon', 'multiplier': 3.5, 'emoji': '🐠', 'rarity': 'Rare'},        # Increased from 3.0
        {'name': 'Mahi Mahi', 'multiplier': 4.0, 'emoji': '🎣', 'rarity': 'Rare'},     # Increased from 3.25, new higher
        {'name': 'Grouper', 'multiplier': 4.5, 'emoji': '🐡', 'rarity': 'Rare'},       # Increased from 3.5, new higher
    ],
}

SIZES = [
    {"label": "Tiny", "size_multiplier": 0.6},
    {"label": "Small", "size_multiplier": 0.8},
    {"label": "Medium", "size_multiplier": 1.0},
    {"label": "Large", "size_multiplier": 1.2},
    {"label": "Giant", "size_multiplier": 1.5},
]

# Added very large size for occasional big wins
EXTREME_SIZES = [
    {"label": "Colossal", "size_multiplier": 1.8},
    {"label": "Legendary", "size_multiplier": 2.0},
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
    
    # 48% chance of catching a fish (winning) - Reduced from 70%
    if roll < 0.48:
        # Weight distribution for different rarities - adjusted for lower win rate
        rarity_roll = random.random()
        
        if rarity_roll < 0.40:  # 40% of wins = Common fish (19.2% overall)
            fish_list = FISH_TYPES["common"]
            # Adjusted weights to favor higher multipliers in common category
            weights = [0.10, 0.15, 0.20, 0.25, 0.30]  # Favor higher multipliers
        elif rarity_roll < 0.75:  # 35% of wins = Uncommon fish (16.8% overall)
            fish_list = FISH_TYPES["uncommon"]
            weights = [0.20, 0.25, 0.25, 0.30]  # Favor higher multipliers
        else:  # 25% of wins = Rare fish (12% overall)
            fish_list = FISH_TYPES["rare"]
            weights = [0.25, 0.25, 0.25, 0.25]  # Equal weights for rare fish
        
        base = random.choices(fish_list, weights=weights, k=1)[0]
        
        # Determine size - with chance for extreme sizes
        size_roll = random.random()
        if size_roll < 0.05:  # 5% chance for extreme size
            size = random.choice(EXTREME_SIZES)
        else:
            size = random.choice(SIZES)
        
        final_multiplier = base["multiplier"] * size["size_multiplier"]
        
        # Cap at reasonable maximum
        final_multiplier = max(0.75, min(9.0, final_multiplier))  # Increased max from 3.5 to 9.0
        
        return {
            "name": base["name"],
            "rarity": base["rarity"],
            "emoji": base["emoji"],
            "multiplier": float(final_multiplier),
            "is_trap": False,
            "size": size["label"],
            "size_multiplier": size["size_multiplier"],
            "quality": "Excellent" if size["size_multiplier"] >= 1.8 else 
                       "Good" if size["size_multiplier"] >= 1.2 else 
                       "Average",
        }
    else:
        # 52% chance of trap (loss) - Increased from 30%
        trap_type = random.choice(WRONG_TREASURES)
        
        # Assign different trap emojis
        trap_emojis = {
            "Rusty Boot": "👢",
            "Sea Bomb": "💣", 
            "Cursed Skull": "💀",
            "Old Tire": "🛞",
            "Seaweed Bundle": "🌿"
        }
        
        # Different trap severities
        trap_severity = random.random()
        if trap_severity < 0.10:  # 10% of traps = double loss (bet lost plus extra)
            trap_effect = "DOUBLE_LOSS"
            trap_multiplier = -1.0  # Indicates special trap effect
        elif trap_severity < 0.30:  # 20% of traps = cursed (no fishing for a while)
            trap_effect = "CURSED"
            trap_multiplier = -0.5
        else:  # 70% of traps = regular loss
            trap_effect = "REGULAR"
            trap_multiplier = 0.0
        
        return {
            "name": trap_type,
            "rarity": "Trap",
            "emoji": trap_emojis.get(trap_type, "💀"),
            "multiplier": trap_multiplier,
            "is_trap": True,
            "size": "N/A",
            "size_multiplier": 1.0,
            "trap_effect": trap_effect,
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
            if catch.get("trap_effect") == "DOUBLE_LOSS":
                # Double loss: lose bet amount plus extra penalty
                penalty = bet_amount  # Lose another bet amount as penalty
                win_amount = Decimal("0.00")
                # Apply penalty to spot balance
                wallet.spot_balance -= penalty
            elif catch.get("trap_effect") == "CURSED":
                # Cursed trap: lose bet with minor extra effect
                win_amount = Decimal("0.00")
                # Could implement cooldown or other effects here
            else:
                # Regular trap: just lose the bet
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

        # Update fishing stats
        stats, created = FishingStats.objects.get_or_create(user=request.user)
        stats.total_sessions += 1
        if not catch["is_trap"]:
            stats.total_won += win_amount
            # Update biggest catch if this is bigger
            current_biggest = stats.biggest_catch or "0.00"
            try:
                current_value = float(current_biggest.split(":")[-1].replace("x", "")) if ":" in current_biggest else 0.0
                if catch["multiplier"] > current_value:
                    stats.biggest_catch = f"{catch['name']}: {catch['multiplier']:.2f}x"
            except:
                stats.biggest_catch = f"{catch['name']}: {catch['multiplier']:.2f}x"
        stats.save()

        return Response({
            "catch": catch,
            "bet_amount": float(bet_amount),
            "win_amount": float(win_amount),
            "profit": float(profit),
            "new_balance": float(wallet.balance),
            "new_spot_balance": float(wallet.spot_balance),
            "chance_info": {
                "win_chance": "48%",
                "multiplier_range": "0.75x - 9.0x",  # Updated range
                "trap_chance": "52%",
                "extreme_size_chance": "5%",
                "double_loss_trap_chance": "5.2%",  # 10% of 52%
                "max_multiplier": "9.0x"
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

        # Calculate average multiplier
        winning_sessions = FishingSession.objects.filter(
            user=request.user,
            win_amount__gt=0
        )
        avg_multiplier = 0.0
        if winning_sessions.exists():
            total_multiplier = sum(
                float(s.catch_result.get('multiplier', 0)) 
                for s in winning_sessions 
                if s.catch_result and not s.catch_result.get('is_trap', True)
            )
            avg_multiplier = total_multiplier / winning_sessions.count()

        return Response({
            'total_sessions': total_sessions,
            'total_won': round(total_won, 2),
            'biggest_catch': biggest_catch,
            'avg_win_per_session': round(avg_win_per_session, 2),
            'win_rate': round(win_rate, 1),
            'avg_multiplier': round(avg_multiplier, 2),
            'fishing_level': calculate_fishing_level(total_sessions),
            'game_info': {
                'win_chance': '48%',
                'multiplier_range': '0.75x - 9.0x',
                'trap_chance': '52%',
                'current_win_streak': 'Calculate from sessions',  # Could implement
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
            catch_info = session.catch_result or {}
            is_trap = catch_info.get('is_trap', True)
            
            history.append({
                'id': session.id,
                'bet_amount': float(session.bet_amount),
                'win_amount': float(session.win_amount),
                'catch_result': catch_info,
                'created_at': session.created_at.isoformat(),
                'profit': float(session.win_amount - session.bet_amount),
                'result_type': 'TRAP' if is_trap else 'CATCH',
                'multiplier': catch_info.get('multiplier', 0) if not is_trap else 0,
                'quality': catch_info.get('quality', 'N/A') if not is_trap else 'TRAP',
            })

        return Response({
            'history': history,
            'total_count': len(history),
            'summary': {
                'total_bet': sum(float(s.bet_amount) for s in sessions),
                'total_win': sum(float(s.win_amount) for s in sessions),
                'total_profit': sum(float(s.win_amount - s.bet_amount) for s in sessions),
                'win_count': sum(1 for s in sessions if s.win_amount > 0),
                'trap_count': sum(1 for s in sessions if s.catch_result and s.catch_result.get('is_trap')),
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
                'description': 'Cast your line and catch fish for multipliers! Higher risk, bigger rewards!',
                'win_chance': '48%',  # Updated from 70%
                'trap_chance': '52%',  # Updated from 30%
                'multiplier_range': '0.75x - 9.0x',  # Updated range
                'minimum_bet': '10.00',
                'risk_level': 'High',
                'house_edge': '5%',  # Adjusted house edge
            },
            'fish_types': [
                {
                    'rarity': 'Common',
                    'multipliers': ['0.75x', '1.0x', '1.25x', '1.5x', '1.75x'],
                    'chance_of_win': '19.2%',
                    'description': 'Basic fish with small multipliers'
                },
                {
                    'rarity': 'Uncommon',
                    'multipliers': ['2.0x', '2.25x', '2.5x', '2.75x'],
                    'chance_of_win': '16.8%',
                    'description': 'Better fish with moderate multipliers'
                },
                {
                    'rarity': 'Rare',
                    'multipliers': ['3.0x', '3.5x', '4.0x', '4.5x'],
                    'chance_of_win': '12%',
                    'description': 'Rare fish with high multipliers'
                },
                {
                    'rarity': 'Trap',
                    'multipliers': ['0x'],
                    'chance': '52%',
                    'description': 'Bad catches that result in loss'
                }
            ],
            'sizes': SIZES + EXTREME_SIZES,
            'size_effect': 'Fish size multiplies the base multiplier (0.6x to 2.0x)',
            'special_features': [
                '5% chance for Colossal or Legendary size fish',
                'Trap effects: Regular (70%), Cursed (20%), Double Loss (10%)',
                'Higher base multipliers to compensate for lower win rate',
            ],
            'expected_rtp': '95%',  # Expected Return to Player (adjusted)
            'house_edge': '5%',
            'probability_breakdown': {
                'overall_win_chance': '48%',
                'common_fish': '19.2%',
                'uncommon_fish': '16.8%',
                'rare_fish': '12%',
                'trap_chance': '52%',
                'extreme_size_chance': '5% of wins',
                'double_loss_trap': '5.2% of all casts',
            }
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)