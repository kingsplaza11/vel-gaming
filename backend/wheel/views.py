import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import WheelGame, WheelStats
from accounts.models import User

# Wheel segments with multipliers (example: 8 segments)
WHEEL_SEGMENTS = [0.5, 1, 2, 5, 10, 2, 1, 0.5]

@api_view(['POST'])
def spin_wheel(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid bet amount'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Spin the wheel
            segment = random.randint(0, len(WHEEL_SEGMENTS) - 1)
            multiplier = Decimal(str(WHEEL_SEGMENTS[segment]))
            win_amount = bet_amount * multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            # Create game record
            game = WheelGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                result_segment=segment,
                multiplier=multiplier,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = WheelStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            stats.save()
            
            return Response({
                'segment': segment,
                'multiplier': float(multiplier),
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'game_id': game.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)