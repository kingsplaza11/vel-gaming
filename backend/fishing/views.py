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

# Base fish data - Updated for 45% above 1.5x and 55% below/lose
FISH_TYPES = {
    'common': [
        # Small wins below 1.5x (part of the 10% small wins)
        {'name': 'Sardine', 'multiplier': 0.5, 'emoji': '🐟', 'rarity': 'Common'},
        {'name': 'Mackerel', 'multiplier': 0.75, 'emoji': '🐠', 'rarity': 'Common'},
        {'name': 'Bass', 'multiplier': 1.0, 'emoji': '🎣', 'rarity': 'Common'},
        {'name': 'Herring', 'multiplier': 1.25, 'emoji': '🐡', 'rarity': 'Common'},
        
        # Wins above 1.5x (45% category)
        {'name': 'Anchovy', 'multiplier': 1.6, 'emoji': '🐟', 'rarity': 'Common'},
        {'name': 'Carp', 'multiplier': 1.8, 'emoji': '🐠', 'rarity': 'Common'},
        {'name': 'Tilapia', 'multiplier': 2.0, 'emoji': '🎣', 'rarity': 'Common'},
    ],
    'uncommon': [
        # Wins above 1.5x (45% category)
        {'name': 'Snapper', 'multiplier': 2.25, 'emoji': '🐟', 'rarity': 'Uncommon'},
        {'name': 'Catfish', 'multiplier': 2.5, 'emoji': '🐠', 'rarity': 'Uncommon'},
        {'name': 'Perch', 'multiplier': 2.75, 'emoji': '🎣', 'rarity': 'Uncommon'},
        {'name': 'Pike', 'multiplier': 3.0, 'emoji': '🐡', 'rarity': 'Uncommon'},
    ],
    'rare': [
        # Wins above 1.5x (45% category)
        {'name': 'Tuna', 'multiplier': 3.5, 'emoji': '🐟', 'rarity': 'Rare'},
        {'name': 'Salmon', 'multiplier': 4.0, 'emoji': '🐠', 'rarity': 'Rare'},
        {'name': 'Mahi Mahi', 'multiplier': 4.5, 'emoji': '🎣', 'rarity': 'Rare'},
        {'name': 'Grouper', 'multiplier': 5.0, 'emoji': '🐡', 'rarity': 'Rare'},
    ],
    'legendary': [
        # Rare high wins above 1.5x (45% category)
        {'name': 'Blue Marlin', 'multiplier': 6.0, 'emoji': '🐟', 'rarity': 'Legendary'},
        {'name': 'Swordfish', 'multiplier': 7.0, 'emoji': '🐠', 'rarity': 'Legendary'},
        {'name': 'Sturgeon', 'multiplier': 8.0, 'emoji': '🎣', 'rarity': 'Legendary'},
        {'name': 'Great White Shark', 'multiplier': 9.0, 'emoji': '🦈', 'rarity': 'Legendary'},
    ]
}

SIZES = [
    {"label": "Tiny", "size_multiplier": 0.8},
    {"label": "Small", "size_multiplier": 0.9},
    {"label": "Medium", "size_multiplier": 1.0},
    {"label": "Large", "size_multiplier": 1.1},
    {"label": "Giant", "size_multiplier": 1.2},
]

EXTREME_SIZES = [
    {"label": "Colossal", "size_multiplier": 1.3},
    {"label": "Legendary", "size_multiplier": 1.5},
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
    
    # 45% chance of winning above 1.5x
    if roll < 0.45:
        # Weight distribution for different rarities - focused on good multipliers
        rarity_roll = random.random()
        
        if rarity_roll < 0.60:  # 60% of above-1.5x wins = Common fish (27% overall)
            fish_list = FISH_TYPES["common"]
            # Weights favor fish with multipliers above 1.5x
            # First 3 fish (0.5x, 0.75x, 1.0x, 1.25x) are below 1.5x - give them low weight
            # Last 3 fish (1.6x, 1.8x, 2.0x) are above 1.5x - give them high weight
            weights = [0.05, 0.05, 0.10, 0.15, 0.25, 0.25, 0.15]
            selected_fish = random.choices(fish_list, weights=weights, k=1)[0]
            
        elif rarity_roll < 0.85:  # 25% of above-1.5x wins = Uncommon fish (11.25% overall)
            fish_list = FISH_TYPES["uncommon"]
            # All uncommon fish are above 1.5x
            weights = [0.20, 0.25, 0.25, 0.30]
            selected_fish = random.choices(fish_list, weights=weights, k=1)[0]
            
        elif rarity_roll < 0.95:  # 10% of above-1.5x wins = Rare fish (4.5% overall)
            fish_list = FISH_TYPES["rare"]
            weights = [0.25, 0.25, 0.25, 0.25]
            selected_fish = random.choices(fish_list, weights=weights, k=1)[0]
            
        else:  # 5% of above-1.5x wins = Legendary fish (2.25% overall)
            fish_list = FISH_TYPES["legendary"]
            weights = [0.25, 0.25, 0.25, 0.25]
            selected_fish = random.choices(fish_list, weights=weights, k=1)[0]
        
        # Determine size
        size_roll = random.random()
        if size_roll < 0.03:  # 3% chance for extreme size
            size = random.choice(EXTREME_SIZES)
        else:
            size = random.choice(SIZES)
        
        # Apply size multiplier
        final_multiplier = selected_fish["multiplier"] * size["size_multiplier"]
        
        # Ensure multiplier is above 1.5x (with size adjustment)
        final_multiplier = max(1.51, final_multiplier)
        
        # Cap at reasonable maximum
        final_multiplier = min(15.0, final_multiplier)
        
        return {
            "name": selected_fish["name"],
            "rarity": selected_fish["rarity"],
            "emoji": selected_fish["emoji"],
            "multiplier": float(final_multiplier),
            "is_trap": False,
            "size": size["label"],
            "size_multiplier": size["size_multiplier"],
            "quality": "Excellent" if size["size_multiplier"] >= 1.3 else 
                       "Good" if size["size_multiplier"] >= 1.1 else 
                       "Average",
        }
    
    # 10% chance of small wins (below 1.5x)
    elif roll < 0.55:
        # Small wins category - below 1.5x multipliers
        small_fish_list = [fish for fish in FISH_TYPES["common"] if fish["multiplier"] <= 1.25]
        
        # Select a small fish
        selected_fish = random.choice(small_fish_list)
        
        # Apply small size multiplier (never extreme for small wins)
        size = random.choice(SIZES[:3])  # Only tiny, small, or medium
        final_multiplier = selected_fish["multiplier"] * size["size_multiplier"]
        
        # Ensure multiplier stays below 1.5x
        final_multiplier = min(1.49, final_multiplier)
        
        return {
            "name": selected_fish["name"],
            "rarity": "Small Catch",
            "emoji": selected_fish["emoji"],
            "multiplier": float(final_multiplier),
            "is_trap": False,
            "size": size["label"],
            "size_multiplier": size["size_multiplier"],
            "quality": "Small",
        }
    
    # 20% chance of traps (part of the 55% lose/below 1.5x category)
    elif roll < 0.75:
        trap_type = random.choice(WRONG_TREASURES)
        
        # Assign different trap emojis
        trap_emojis = {
            "Rusty Boot": "👢",
            "Sea Bomb": "💣", 
            "Cursed Skull": "💀",
            "Old Tire": "🛞",
            "Seaweed Bundle": "🌿"
        }
        
        # Trap severities
        trap_severity = random.random()
        if trap_severity < 0.10:  # 10% of traps = double loss (2% overall)
            trap_effect = "DOUBLE_LOSS"
            trap_multiplier = -1.0
        elif trap_severity < 0.30:  # 20% of traps = cursed (4% overall)
            trap_effect = "CURSED"
            trap_multiplier = -0.5
        else:  # 70% of traps = regular loss (14% overall)
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
    
    # 15% chance of penalty (reduced multiplier)
    elif roll < 0.90:
        # Penalty - reduce bet by 50%
        penalty_types = ["Tangled Line", "Broken Rod", "Stolen Bait", "Escaped Fish"]
        penalty_type = random.choice(penalty_types)
        
        return {
            "name": penalty_type,
            "rarity": "Penalty",
            "emoji": "⚡",
            "multiplier": 0.5,  # Lose 50% of bet
            "is_trap": True,
            "size": "N/A",
            "size_multiplier": 1.0,
            "trap_effect": "PENALTY",
        }
    
    # 10% chance of complete loss
    else:
        trap_type = random.choice(WRONG_TREASURES)
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
            "trap_effect": "COMPLETE_LOSS",
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

        # Calculate win amount based on catch type
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
            elif catch.get("trap_effect") == "PENALTY":
                # Penalty: lose 50% of bet
                win_amount = bet_amount * Decimal(str(catch["multiplier"]))
                win_amount = win_amount.quantize(Decimal("0.01"))
            elif catch.get("trap_effect") == "COMPLETE_LOSS":
                # Complete loss: lose entire bet
                win_amount = Decimal("0.00")
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
                "win_chance": "55% (45% above 1.5x + 10% below 1.5x)",
                "lose_chance": "45%",
                "multiplier_range": "1.51x - 15.0x for good catches",
                "trap_chance": "20%",
                "penalty_chance": "15%",
                "extreme_size_chance": "3%",
                "max_multiplier": "15.0x"
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
                'description': 'Cast your line and catch fish for multipliers! Aim for catches above 1.5x!',
                'win_chance_above_1.5x': '45%',
                'small_win_chance': '10%',
                'lose_chance': '45%',
                'multiplier_range': '1.51x - 15.0x for good catches',
                'minimum_bet': '10.00',
                'risk_level': 'Medium',
                'house_edge': '5%',
            },
            'fish_types': [
                {
                    'rarity': 'Common',
                    'description': 'Basic fish with multipliers from 0.5x to 2.0x'
                },
                {
                    'rarity': 'Uncommon',
                    'description': 'Better fish with multipliers from 2.25x to 3.0x'
                },
                {
                    'rarity': 'Rare',
                    'description': 'Rare fish with multipliers from 3.5x to 5.0x'
                },
                {
                    'rarity': 'Legendary',
                    'description': 'Legendary fish with multipliers from 6.0x to 9.0x'
                }
            ],
            'sizes': SIZES + EXTREME_SIZES,
            'size_effect': 'Fish size multiplies the base multiplier (0.8x to 1.5x)',
            'special_features': [
                '45% chance to catch fish above 1.5x multiplier',
                '10% chance for small catches below 1.5x',
                '20% chance of traps',
                '15% chance of penalties (50% loss)',
                '10% chance of complete loss',
                '3% chance for extreme size fish',
            ],
            'expected_rtp': '95%',
            'house_edge': '5%',
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)