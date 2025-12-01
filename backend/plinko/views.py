import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import PlinkoGame, PlinkoStats
from accounts.models import User

# Multipliers for each risk level and slot (example)
MULTIPLIERS = {
    'low': [1.2, 1.4, 1.6, 1.8, 2.0, 1.8, 1.6, 1.4, 1.2],
    'medium': [0.5, 1, 2, 4, 8, 4, 2, 1, 0.5],
    'high': [0.1, 0.5, 2, 10, 20, 10, 2, 0.5, 0.1]
}

@api_view(['POST'])
def drop_plinko(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        risk_level = request.data.get('risk_level', 'medium')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if risk_level not in MULTIPLIERS:
        return Response({'error': 'Invalid risk level'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Simulate the plinko drop (random slot)
            slot = random.randint(0, 8)  # 9 slots (0-8)
            multiplier = Decimal(str(MULTIPLIERS[risk_level][slot]))
            win_amount = bet_amount * multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            # Create game record
            game = PlinkoGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                risk_level=risk_level,
                result_slot=slot,
                multiplier=multiplier,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = PlinkoStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            stats.save()
            
            return Response({
                'slot': slot,
                'multiplier': float(multiplier),
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'game_id': game.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)