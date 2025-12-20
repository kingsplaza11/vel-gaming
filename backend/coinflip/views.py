import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import CoinFlipGame, CoinFlipStats
from accounts.models import User

@api_view(['POST'])
def flip_coin(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        chosen_side = request.data.get('chosen_side', 'heads')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if chosen_side not in ['heads', 'tails']:
        return Response({'error': 'Invalid side'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Flip the coin
            result = random.choice(['heads', 'tails'])
            win = chosen_side == result
            win_amount = bet_amount * Decimal('2') if win else Decimal('0')
            
            # Add winnings
            if win:
                user.balance += win_amount
                user.save()
            
            # Create game record
            game = CoinFlipGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                chosen_side=chosen_side,
                result=result,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = CoinFlipStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            if win:
                stats.wins += 1
            else:
                stats.losses += 1
            stats.save()
            
            return Response({
                'result': result,
                'win': win,
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'game_id': game.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)