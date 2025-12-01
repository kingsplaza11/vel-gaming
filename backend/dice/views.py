import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import DiceGame, DiceStats
from accounts.models import User

@api_view(['POST'])
def roll_dice(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        bet_type = request.data.get('bet_type', 'number')
        bet_value = request.data.get('bet_value', '1')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Roll the dice (1-6)
            dice_roll = random.randint(1, 6)
            
            # Check win
            win = False
            payout = 1
            
            if bet_type == 'number':
                if dice_roll == int(bet_value):
                    win = True
                    payout = 6  # 6:1 payout for specific number
            elif bet_type == 'even_odd':
                if (bet_value == 'even' and dice_roll % 2 == 0) or (bet_value == 'odd' and dice_roll % 2 == 1):
                    win = True
                    payout = 2
            elif bet_type == 'high_low':
                if (bet_value == 'high' and dice_roll >= 4) or (bet_value == 'low' and dice_roll <= 3):
                    win = True
                    payout = 2
            
            win_amount = bet_amount * Decimal(payout) if win else Decimal('0')
            
            # Add winnings
            if win:
                user.balance += win_amount
                user.save()
            
            # Create game record
            game = DiceGame.objects.create(
                user=user,
                bet_amount=bet_amount,
                bet_type=bet_type,
                bet_value=bet_value,
                dice_roll=dice_roll,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = DiceStats.objects.get_or_create(user=user)
            stats.total_games += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            stats.save()
            
            return Response({
                'dice_roll': dice_roll,
                'win': win,
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'game_id': game.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)