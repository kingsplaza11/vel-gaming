import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Count, Q
from .models import DragonBattle, DragonStats
from accounts.models import User

DRAGONS = {
    'earth': {'name': 'Earth Dragon', 'image': '🐉', 'base_multiplier': 2.0, 'weakness': 'air'},
    'fire': {'name': 'Fire Dragon', 'image': '🔥', 'base_multiplier': 2.5, 'weakness': 'water'},
    'water': {'name': 'Water Dragon', 'image': '💧', 'base_multiplier': 3.0, 'weakness': 'earth'},
    'air': {'name': 'Air Dragon', 'image': '💨', 'base_multiplier': 3.5, 'weakness': 'fire'},
    'legendary': {'name': 'Ancient Dragon', 'image': '🐲', 'base_multiplier': 5.0, 'weakness': None}
}

ELEMENTS = ['earth', 'fire', 'water', 'air']

@api_view(['POST'])
def start_battle(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        user_element = request.data.get('element', 'fire')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if user_element not in ELEMENTS:
        return Response({'error': 'Invalid element'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            # Determine opponent dragon (5% chance for legendary)
            is_legendary = random.random() < 0.05
            if is_legendary:
                opponent_dragon = DRAGONS['legendary']
            else:
                opponent_element = random.choice([e for e in ELEMENTS if e != user_element])
                opponent_dragon = DRAGONS[opponent_element]
            
            # Calculate battle outcome
            user_power = random.uniform(0.7, 1.3)
            opponent_power = random.uniform(0.7, 1.3)
            
            # Element advantage
            has_element_advantage = opponent_dragon['weakness'] == user_element
            if has_element_advantage:
                user_power *= 1.5
            
            # Determine winner
            if user_power > opponent_power:
                outcome = 'victory'
                base_multiplier = opponent_dragon['base_multiplier']
                
                # Critical hit chance
                is_critical = random.random() < 0.1  # 10% critical
                if is_critical:
                    base_multiplier *= 2
                    
                win_amount = bet_amount * Decimal(str(base_multiplier))
            else:
                outcome = 'defeat'
                win_amount = Decimal('0')
                is_critical = False
            
            # Add winnings if victorious
            if outcome == 'victory':
                user.balance += win_amount
                user.save()
            
            # Create battle record
            battle = DragonBattle.objects.create(
                user=user,
                bet_amount=bet_amount,
                dragon_type=opponent_dragon['name'],
                battle_result={
                    'outcome': outcome,
                    'opponent': opponent_dragon,
                    'user_power': round(user_power, 2),
                    'opponent_power': round(opponent_power, 2),
                    'critical': is_critical,
                    'element_advantage': has_element_advantage,
                    'is_legendary': is_legendary
                },
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = DragonStats.objects.get_or_create(user=user)
            stats.total_battles += 1
            stats.total_bet += bet_amount
            
            if outcome == 'victory':
                stats.victories += 1
                stats.total_won += win_amount
                
                # Update highest win
                if win_amount > stats.highest_win:
                    stats.highest_win = win_amount
                
                # Update legendary stats
                if is_legendary:
                    stats.legendary_victories += 1
            else:
                stats.defeats += 1
            
            # Update legendary battles
            if is_legendary:
                stats.legendary_battles += 1
            
            # Update critical hits and element advantages
            if is_critical:
                stats.critical_hits += 1
            
            if has_element_advantage:
                stats.element_advantages += 1
            
            stats.save()
            
            return Response({
                'outcome': outcome,
                'opponent_dragon': opponent_dragon,
                'battle_details': battle.battle_result,
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'battle_id': battle.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_dragon_stats(request):
    """
    Get dragon battle statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get or create stats for the user
        stats, created = DragonStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_battles = stats.total_battles
        victories = stats.victories
        defeats = stats.defeats
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        highest_win = float(stats.highest_win) if stats.highest_win else 0
        
        # Calculate win rate
        win_rate = (victories / total_battles * 100) if total_battles > 0 else 0
        
        # Calculate profit and ROI
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        
        # Calculate legendary success rate
        legendary_success_rate = (stats.legendary_victories / stats.legendary_battles * 100) if stats.legendary_battles > 0 else 0
        
        # Calculate critical hit rate
        critical_rate = (stats.critical_hits / victories * 100) if victories > 0 else 0
        
        # Calculate element advantage rate
        element_advantage_rate = (stats.element_advantages / total_battles * 100) if total_battles > 0 else 0
        
        return Response({
            'total_battles': total_battles,
            'victories': victories,
            'defeats': defeats,
            'win_rate': round(win_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'highest_win': round(highest_win, 2),
            'legendary_battles': stats.legendary_battles,
            'legendary_victories': stats.legendary_victories,
            'legendary_success_rate': round(legendary_success_rate, 2),
            'critical_hits': stats.critical_hits,
            'critical_rate': round(critical_rate, 2),
            'element_advantages': stats.element_advantages,
            'element_advantage_rate': round(element_advantage_rate, 2),
            'dragon_slayer_rank': calculate_dragon_slayer_rank(victories, stats.legendary_victories)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_dragon_history(request):
    """
    Get recent dragon battle history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 dragon battles, most recent first
        battles = DragonBattle.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for battle in battles:
            profit = battle.win_amount - battle.bet_amount
            
            history.append({
                'id': battle.id,
                'dragon_type': battle.dragon_type,
                'bet_amount': float(battle.bet_amount),
                'win_amount': float(battle.win_amount),
                'profit': float(profit),
                'outcome': battle.battle_result.get('outcome', 'unknown'),
                'opponent': battle.battle_result.get('opponent', {}),
                'user_power': battle.battle_result.get('user_power', 0),
                'opponent_power': battle.battle_result.get('opponent_power', 0),
                'critical': battle.battle_result.get('critical', False),
                'element_advantage': battle.battle_result.get('element_advantage', False),
                'is_legendary': battle.battle_result.get('is_legendary', False),
                'created_at': battle.created_at.isoformat(),
                'was_victorious': battle.battle_result.get('outcome') == 'victory'
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_element_stats(request):
    """
    Get battle statistics per element for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        element_stats = []
        
        # Get battles grouped by opponent type (which implies element)
        for element in ELEMENTS + ['legendary']:
            dragon_name = DRAGONS[element]['name'] if element != 'legendary' else DRAGONS['legendary']['name']
            
            battles = DragonBattle.objects.filter(
                user=request.user, 
                dragon_type=dragon_name
            )
            battle_count = battles.count()
            
            if battle_count > 0:
                victories = battles.filter(battle_result__outcome='victory').count()
                defeats = battle_count - victories
                total_won = battles.aggregate(Sum('win_amount'))['win_amount__sum'] or Decimal('0')
                total_bet = battles.aggregate(Sum('bet_amount'))['bet_amount__sum'] or Decimal('0')
                
                win_rate = (victories / battle_count * 100) if battle_count > 0 else 0
                total_profit = total_won - total_bet
                
                element_stats.append({
                    'element': element,
                    'dragon_name': dragon_name,
                    'battle_count': battle_count,
                    'victories': victories,
                    'defeats': defeats,
                    'win_rate': round(win_rate, 2),
                    'total_won': float(total_won),
                    'total_bet': float(total_bet),
                    'total_profit': float(total_profit),
                    'weakness': DRAGONS[element]['weakness'] if element != 'legendary' else None
                })
            else:
                element_stats.append({
                    'element': element,
                    'dragon_name': dragon_name,
                    'battle_count': 0,
                    'victories': 0,
                    'defeats': 0,
                    'win_rate': 0,
                    'total_won': 0,
                    'total_bet': 0,
                    'total_profit': 0,
                    'weakness': DRAGONS[element]['weakness'] if element != 'legendary' else None
                })
        
        return Response({
            'element_stats': element_stats
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_streak_stats(request):
    """
    Get current win/loss streak and best streaks for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get all battles in chronological order
        battles = DragonBattle.objects.filter(user=request.user).order_by('created_at')
        
        current_streak = 0
        current_streak_type = None  # 'win' or 'loss'
        best_win_streak = 0
        best_loss_streak = 0
        current_win_streak = 0
        current_loss_streak = 0
        
        for battle in battles:
            outcome = battle.battle_result.get('outcome')
            
            if outcome == 'victory':
                current_win_streak += 1
                current_loss_streak = 0
                if current_win_streak > best_win_streak:
                    best_win_streak = current_win_streak
            else:  # defeat
                current_loss_streak += 1
                current_win_streak = 0
                if current_loss_streak > best_loss_streak:
                    best_loss_streak = current_loss_streak
        
        # Determine current streak
        if battles.exists():
            last_battle = battles.last()
            last_outcome = last_battle.battle_result.get('outcome')
            
            if last_outcome == 'victory':
                current_streak = current_win_streak
                current_streak_type = 'win'
            else:
                current_streak = current_loss_streak
                current_streak_type = 'loss'
        
        return Response({
            'current_streak': current_streak,
            'current_streak_type': current_streak_type,
            'best_win_streak': best_win_streak,
            'best_loss_streak': best_loss_streak,
            'current_win_streak': current_win_streak,
            'current_loss_streak': current_loss_streak
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_dragon_slayer_rank(victories, legendary_victories):
    """
    Calculate dragon slayer rank based on total victories and legendary victories
    """
    if victories >= 100 and legendary_victories >= 10:
        return "Dragon God ⚡"
    elif victories >= 50 and legendary_victories >= 5:
        return "Master Dragon Slayer 🐉"
    elif victories >= 25 and legendary_victories >= 2:
        return "Elite Dragon Hunter ⚔️"
    elif victories >= 10:
        return "Seasoned Dragon Fighter 🛡️"
    elif victories >= 5:
        return "Amateur Dragon Tamer 🎯"
    else:
        return "Novice Dragon Challenger 🏹"