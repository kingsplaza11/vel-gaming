# treasure/views.py
import random
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Sum, Max, Avg, F
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import TreasureHunt, TreasureStats
from accounts.models import User
from accounts.serializers import UserSerializer


TREASURES = {
    1: [
        {'name': 'Bronze Coin', 'multiplier': 1.2, 'image': '🪙'},
        {'name': 'Silver Ring', 'multiplier': 1.5, 'image': '💍'},
        {'name': 'Ancient Pottery', 'multiplier': 1.8, 'image': '🏺'},
    ],
    2: [
        {'name': 'Gold Necklace', 'multiplier': 2.0, 'image': '📿'},
        {'name': 'Gemstone', 'multiplier': 2.5, 'image': '💎'},
        {'name': 'Crystal Orb', 'multiplier': 3.0, 'image': '🔮'},
    ],
    3: [
        {'name': 'Royal Crown', 'multiplier': 4.0, 'image': '👑'},
        {'name': 'Dragon Egg', 'multiplier': 5.0, 'image': '🥚'},
        {'name': 'Magic Staff', 'multiplier': 6.0, 'image': '🪄'},
    ],
    4: [
        {'name': 'Phoenix Feather', 'multiplier': 8.0, 'image': '🪶'},
        {'name': 'Unicorn Horn', 'multiplier': 10.0, 'image': '🦄'},
        {'name': 'Mermaid Scale', 'multiplier': 12.0, 'image': '🧜'},
    ],
    5: [
        {'name': 'Infinity Stone', 'multiplier': 20.0, 'image': '💠'},
        {'name': 'Cosmic Key', 'multiplier': 25.0, 'image': '🔑'},
        {'name': 'Holy Grail', 'multiplier': 50.0, 'image': '🏆'},
    ]
}


# ---- USER PROFILE VIEW ----
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """
    Returns user profile and handles Decimal balance formatting safely
    """
    user = request.user
    try:
        # Ensure balance is Decimal before serializing
        if hasattr(user, 'balance'):
            try:
                # Convert to Decimal if it's a string
                if isinstance(user.balance, str):
                    user.balance = Decimal(user.balance)
                user.save(update_fields=['balance'])
            except (InvalidOperation, ValueError, TypeError):
                user.balance = Decimal('0.00')
                user.save(update_fields=['balance'])
        
        profile_data = UserSerializer(user).data
        return Response(profile_data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---- TREASURE HUNT START ----
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_hunt(request):
    try:
        # Safely get and validate bet_amount
        bet_amount_str = request.data.get("bet_amount", "10")
        
        # Remove any non-numeric characters except . and -
        import re
        bet_amount_str = re.sub(r'[^\d.-]', '', str(bet_amount_str))
        
        if not bet_amount_str:
            return Response({"error": "Bet amount is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            bet_amount = Decimal(bet_amount_str)
        except (InvalidOperation, ValueError):
            return Response({"error": "Invalid bet amount format"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate map_level
        try:
            map_level = int(request.data.get("map_level", 1))
        except (ValueError, TypeError):
            return Response({"error": "Invalid map level"}, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({"error": f"Invalid parameters: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    if bet_amount <= 0:
        return Response({"error": "Bet amount must be greater than 0"}, status=status.HTTP_400_BAD_REQUEST)

    if map_level < 1 or map_level > 5:
        return Response({"error": "Map level must be between 1 and 5"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        with transaction.atomic():
            # Get user with lock for thread safety
            user = User.objects.select_for_update().get(id=request.user.id)
            
            # Ensure user balance is Decimal
            try:
                if isinstance(user.balance, str):
                    user.balance = Decimal(user.balance)
            except (InvalidOperation, ValueError):
                user.balance = Decimal('0.00')
            
            level_cost_multiplier = Decimal(str(map_level * 1.5))
            total_cost = bet_amount * level_cost_multiplier

            if user.balance < total_cost:
                return Response({"error": "Insufficient balance"}, status=status.HTTP_400_BAD_REQUEST)

            # Deduct cost
            user.balance -= total_cost
            user.save(update_fields=["balance"])

            # Find treasures
            treasures_found = []
            total_multiplier = Decimal("1.0")

            for _ in range(3):
                treasure = random.choice(TREASURES[map_level])
                treasures_found.append(treasure)
                total_multiplier *= Decimal(str(treasure["multiplier"]))

            win_amount = bet_amount * total_multiplier

            # Add winnings
            user.balance += win_amount
            user.save(update_fields=["balance"])

            # Create hunt record
            hunt = TreasureHunt.objects.create(
                user=user,
                bet_amount=bet_amount,
                map_level=map_level,
                treasures_found=treasures_found,
                total_multiplier=total_multiplier,
                win_amount=win_amount,
            )

            # Update stats
            stats, _ = TreasureStats.objects.get_or_create(user=user)
            stats.total_hunts += 1
            stats.total_bet += total_cost
            stats.total_won += win_amount
            stats.highest_multiplier = max(stats.highest_multiplier, total_multiplier)
            stats.highest_level_completed = max(stats.highest_level_completed, map_level)
            
            # Ensure stats fields are Decimal
            if isinstance(stats.total_bet, str):
                stats.total_bet = Decimal(stats.total_bet)
            if isinstance(stats.total_won, str):
                stats.total_won = Decimal(stats.total_won)
            if isinstance(stats.highest_multiplier, str):
                stats.highest_multiplier = Decimal(stats.highest_multiplier)
                
            stats.save()

            return Response({
                "treasures_found": treasures_found,
                "total_multiplier": float(total_multiplier),
                "win_amount": float(win_amount),
                "new_balance": float(user.balance),
                "map_level": map_level,
                "total_cost": float(total_cost),
                "hunt_id": hunt.id
            })

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ---- TREASURE STATS ----
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_treasure_stats(request):
    try:
        stats, _ = TreasureStats.objects.get_or_create(user=request.user)
        
        # Ensure all Decimal fields are valid
        try:
            if isinstance(stats.total_won, str):
                stats.total_won = Decimal(stats.total_won) if stats.total_won else Decimal('0.00')
            if isinstance(stats.total_bet, str):
                stats.total_bet = Decimal(stats.total_bet) if stats.total_bet else Decimal('0.00')
            if isinstance(stats.highest_multiplier, str):
                stats.highest_multiplier = Decimal(stats.highest_multiplier) if stats.highest_multiplier else Decimal('0.00')
            stats.save()
        except (InvalidOperation, ValueError):
            stats.total_won = Decimal('0.00')
            stats.total_bet = Decimal('0.00')
            stats.highest_multiplier = Decimal('0.00')
            stats.save()

        total_hunts = stats.total_hunts
        total_won = float(stats.total_won or Decimal('0.00'))
        total_bet = float(stats.total_bet or Decimal('0.00'))
        highest_multiplier = float(stats.highest_multiplier or Decimal('0.00'))
        highest_level = stats.highest_level_completed

        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0.0

        successful_hunts = TreasureHunt.objects.filter(
            user=request.user,
            win_amount__gt=F("bet_amount")
        ).count()

        success_rate = (successful_hunts / total_hunts * 100) if total_hunts > 0 else 0.0

        return Response({
            "total_hunts": total_hunts,
            "total_won": round(total_won, 2),
            "total_bet": round(total_bet, 2),
            "total_profit": round(total_profit, 2),
            "roi": round(roi, 2),
            "highest_multiplier": round(highest_multiplier, 2),
            "highest_level_completed": highest_level,
            "success_rate": round(success_rate, 2),
        })

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_treasure_history(request):
    """
    Get recent treasure hunting history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        hunts = TreasureHunt.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for hunt in hunts:
            level_cost_multiplier = Decimal(str(hunt.map_level * 1.5))
            total_cost = hunt.bet_amount * level_cost_multiplier
            profit = hunt.win_amount - total_cost
            
            history.append({
                'id': hunt.id,
                'map_level': hunt.map_level,
                'bet_amount': float(hunt.bet_amount),
                'total_cost': float(total_cost),
                'win_amount': float(hunt.win_amount),
                'profit': float(profit),
                'total_multiplier': float(hunt.total_multiplier),
                'treasures_found': hunt.treasures_found,
                'created_at': hunt.created_at.isoformat(),
                'was_profitable': profit > 0,
            })
       
        return Response({
            'history': history,
            'total_count': len(history),
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_level_stats(request):
    """
    Get statistics per map level for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        level_stats = []
        
        for level in range(1, 6):
            hunts = TreasureHunt.objects.filter(user=request.user, map_level=level)
            hunt_count = hunts.count()
            
            if hunt_count > 0:
                total_won = hunts.aggregate(Sum('win_amount'))['win_amount__sum'] or Decimal('0')
                total_bet = hunts.aggregate(Sum('bet_amount'))['bet_amount__sum'] or Decimal('0')
                avg_multiplier = hunts.aggregate(Avg('total_multiplier'))['total_multiplier__avg'] or Decimal('0')
                highest_multiplier = hunts.aggregate(Max('total_multiplier'))['total_multiplier__max'] or Decimal('0')
                
                level_cost_multiplier = Decimal(str(level * 1.5))
                total_cost = total_bet * level_cost_multiplier
                total_profit = total_won - total_cost
                
                # Ensure we're working with floats for response
                level_stats.append({
                    'level': level,
                    'hunt_count': hunt_count,
                    'total_won': float(total_won),
                    'total_cost': float(total_cost),
                    'total_profit': float(total_profit),
                    'avg_multiplier': float(avg_multiplier),
                    'highest_multiplier': float(highest_multiplier),
                    'level_name': get_level_name(level),
                })
            else:
                level_stats.append({
                    'level': level,
                    'hunt_count': 0,
                    'total_won': 0.0,
                    'total_cost': 0.0,
                    'total_profit': 0.0,
                    'avg_multiplier': 0.0,
                    'highest_multiplier': 0.0,
                    'level_name': get_level_name(level),
                })
        
        return Response({
            'level_stats': level_stats
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def calculate_explorer_rank(total_hunts, highest_level):
    """
    Calculate explorer rank based on total hunts and highest level completed
    """
    if total_hunts >= 100 and highest_level == 5:
        return "Master Explorer 🗺️"
    elif total_hunts >= 50 and highest_level >= 4:
        return "Elite Adventurer ⚔️"
    elif total_hunts >= 25 and highest_level >= 3:
        return "Seasoned Hunter 🎯"
    elif total_hunts >= 10 and highest_level >= 2:
        return "Amateur Explorer 🧭"
    else:
        return "Novice Treasure Hunter 🏹"


def get_level_name(level):
    """
    Get the name for each map level
    """
    level_names = {
        1: "Beginner Island",
        2: "Ancient Forest", 
        3: "Dragon Mountain",
        4: "Phantom Desert",
        5: "Celestial Realm",
    }
    return level_names.get(level, f"Level {level}")