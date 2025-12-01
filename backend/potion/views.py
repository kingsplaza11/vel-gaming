import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Count, Q
from .models import PotionBrew, PotionStats
from accounts.models import User

INGREDIENTS = {
    'common': [
        {'name': 'Moonstone Dust', 'image': '🌙', 'power': 1.2, 'type': 'magical'},
        {'name': 'Dragon Scale', 'image': '🐉', 'power': 1.5, 'type': 'creature'},
        {'name': 'Crystal Shard', 'image': '💎', 'power': 1.3, 'type': 'earth'},
        {'name': 'Phoenix Feather', 'image': '🪶', 'power': 1.8, 'type': 'fire'},
    ],
    'rare': [
        {'name': 'Unicorn Tears', 'image': '🦄', 'power': 2.5, 'type': 'divine'},
        {'name': 'Mermaid Pearl', 'image': '🧜', 'power': 2.2, 'type': 'water'},
        {'name': 'Ancient Rune', 'image': '🔣', 'power': 2.0, 'type': 'magical'},
        {'name': 'Starlight Essence', 'image': '⭐', 'power': 3.0, 'type': 'cosmic'},
    ],
    'legendary': [
        {'name': 'Time Sand', 'image': '⏳', 'power': 5.0, 'type': 'temporal'},
        {'name': 'Soul Fragment', 'image': '👻', 'power': 4.0, 'type': 'spiritual'},
        {'name': 'Reality Shard', 'image': '🌀', 'power': 6.0, 'type': 'cosmic'},
        {'name': 'Infinity Particle', 'image': '♾️', 'power': 8.0, 'type': 'divine'},
    ]
}

POTION_TYPES = {
    'healing': {'name': 'Healing Potion', 'base_value': 2.0, 'preferred_types': ['divine', 'earth']},
    'mana': {'name': 'Mana Potion', 'base_value': 2.5, 'preferred_types': ['magical', 'cosmic']},
    'strength': {'name': 'Strength Potion', 'base_value': 3.0, 'preferred_types': ['creature', 'fire']},
    'luck': {'name': 'Luck Potion', 'base_value': 4.0, 'preferred_types': ['divine', 'cosmic']},
}

@api_view(['POST'])
def brew_potion(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        potion_type = request.data.get('potion_type', 'healing')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if potion_type not in POTION_TYPES:
        return Response({'error': 'Invalid potion type'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            if user.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct bet amount
            user.balance -= bet_amount
            user.save()
            
            potion_recipe = POTION_TYPES[potion_type]
            
            # Select 3 ingredients (weighted by rarity)
            ingredients_used = []
            total_power = Decimal('1.0')
            legendary_count = 0
            preferred_matches = 0
            
            for _ in range(3):
                rand = random.random()
                if rand < 0.60:  # 60% common
                    ingredient_pool = INGREDIENTS['common']
                    rarity = 'common'
                elif rand < 0.90:  # 30% rare
                    ingredient_pool = INGREDIENTS['rare']
                    rarity = 'rare'
                else:  # 10% legendary
                    ingredient_pool = INGREDIENTS['legendary']
                    rarity = 'legendary'
                    legendary_count += 1
                
                ingredient = random.choice(ingredient_pool)
                ingredients_used.append({**ingredient, 'rarity': rarity})
                
                # Check if ingredient type matches potion preference
                type_bonus = 1.5 if ingredient['type'] in potion_recipe['preferred_types'] else 1.0
                if type_bonus > 1.0:
                    preferred_matches += 1
                
                total_power *= Decimal(str(ingredient['power'])) * Decimal(str(type_bonus))
            
            # Determine brew success
            brew_skill = random.uniform(0.5, 1.5)
            final_multiplier = Decimal(str(potion_recipe['base_value'])) * total_power * Decimal(str(brew_skill))
            
            # Success levels
            if brew_skill > 1.2:
                success_level = 'perfect'
                final_multiplier *= Decimal('1.5')
            elif brew_skill > 0.8:
                success_level = 'good'
            else:
                success_level = 'failed'
                final_multiplier = Decimal('0.5')  # Partial refund for failed brew
            
            win_amount = bet_amount * final_multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            # Create brew record
            brew = PotionBrew.objects.create(
                user=user,
                bet_amount=bet_amount,
                ingredients_used=ingredients_used,
                potion_result={
                    'potion_type': potion_recipe['name'],
                    'success_level': success_level,
                    'brew_skill': round(brew_skill, 2),
                    'final_multiplier': float(final_multiplier),
                    'legendary_count': legendary_count,
                    'preferred_matches': preferred_matches
                },
                success_level=success_level,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = PotionStats.objects.get_or_create(user=user)
            stats.total_brews += 1
            stats.total_bet += bet_amount
            stats.total_won += win_amount
            
            # Update success counters
            if success_level == 'perfect':
                stats.perfect_brews += 1
            elif success_level == 'good':
                stats.good_brews += 1
            else:
                stats.failed_brews += 1
            
            # Update legendary ingredients count
            stats.legendary_ingredients_used += legendary_count
            
            # Update preferred ingredient matches
            stats.preferred_ingredient_matches += preferred_matches
            
            # Update highest multiplier
            if final_multiplier > stats.highest_multiplier:
                stats.highest_multiplier = final_multiplier
            
            stats.save()
            
            return Response({
                'potion_type': potion_recipe['name'],
                'ingredients_used': ingredients_used,
                'success_level': success_level,
                'final_multiplier': float(final_multiplier),
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'brew_id': brew.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_potion_stats(request):
    """
    Get potion brewing statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get or create stats for the user
        stats, created = PotionStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_brews = stats.total_brews
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        highest_multiplier = float(stats.highest_multiplier) if stats.highest_multiplier else 0
        
        # Calculate success rates
        perfect_rate = (stats.perfect_brews / total_brews * 100) if total_brews > 0 else 0
        good_rate = (stats.good_brews / total_brews * 100) if total_brews > 0 else 0
        failed_rate = (stats.failed_brews / total_brews * 100) if total_brews > 0 else 0
        overall_success_rate = ((stats.perfect_brews + stats.good_brews) / total_brews * 100) if total_brews > 0 else 0
        
        # Calculate profit and ROI
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        
        # Calculate legendary ingredient rate
        legendary_rate = (stats.legendary_ingredients_used / (total_brews * 3) * 100) if total_brews > 0 else 0
        
        # Calculate preferred match rate
        preferred_match_rate = (stats.preferred_ingredient_matches / (total_brews * 3) * 100) if total_brews > 0 else 0
        
        return Response({
            'total_brews': total_brews,
            'perfect_brews': stats.perfect_brews,
            'good_brews': stats.good_brews,
            'failed_brews': stats.failed_brews,
            'perfect_rate': round(perfect_rate, 2),
            'good_rate': round(good_rate, 2),
            'failed_rate': round(failed_rate, 2),
            'overall_success_rate': round(overall_success_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'highest_multiplier': round(highest_multiplier, 2),
            'legendary_ingredients_used': stats.legendary_ingredients_used,
            'legendary_rate': round(legendary_rate, 2),
            'preferred_ingredient_matches': stats.preferred_ingredient_matches,
            'preferred_match_rate': round(preferred_match_rate, 2),
            'alchemist_rank': calculate_alchemist_rank(total_brews, stats.perfect_brews, highest_multiplier)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_potion_history(request):
    """
    Get recent potion brewing history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 potion brews, most recent first
        brews = PotionBrew.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for brew in brews:
            profit = brew.win_amount - brew.bet_amount
            
            history.append({
                'id': brew.id,
                'potion_type': brew.potion_result.get('potion_type', 'Unknown'),
                'bet_amount': float(brew.bet_amount),
                'win_amount': float(brew.win_amount),
                'profit': float(profit),
                'success_level': brew.success_level,
                'final_multiplier': brew.potion_result.get('final_multiplier', 0),
                'brew_skill': brew.potion_result.get('brew_skill', 0),
                'ingredients_used': brew.ingredients_used,
                'legendary_count': brew.potion_result.get('legendary_count', 0),
                'preferred_matches': brew.potion_result.get('preferred_matches', 0),
                'created_at': brew.created_at.isoformat(),
                'was_profitable': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_potion_type_stats(request):
    """
    Get statistics per potion type for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        potion_type_stats = []
        
        for potion_key, potion_data in POTION_TYPES.items():
            brews = PotionBrew.objects.filter(
                user=request.user,
                potion_result__potion_type=potion_data['name']
            )
            brew_count = brews.count()
            
            if brew_count > 0:
                perfect_brews = brews.filter(success_level='perfect').count()
                good_brews = brews.filter(success_level='good').count()
                failed_brews = brews.filter(success_level='failed').count()
                
                total_won = brews.aggregate(Sum('win_amount'))['win_amount__sum'] or Decimal('0')
                total_bet = brews.aggregate(Sum('bet_amount'))['bet_amount__sum'] or Decimal('0')
                avg_multiplier = brews.aggregate(avg_multiplier=Avg('potion_result__final_multiplier'))['avg_multiplier'] or 0
                highest_multiplier = max([brew.potion_result.get('final_multiplier', 0) for brew in brews], default=0)
                
                total_profit = total_won - total_bet
                success_rate = ((perfect_brews + good_brews) / brew_count * 100) if brew_count > 0 else 0
                
                potion_type_stats.append({
                    'potion_type': potion_key,
                    'potion_name': potion_data['name'],
                    'brew_count': brew_count,
                    'perfect_brews': perfect_brews,
                    'good_brews': good_brews,
                    'failed_brews': failed_brews,
                    'success_rate': round(success_rate, 2),
                    'total_won': float(total_won),
                    'total_bet': float(total_bet),
                    'total_profit': float(total_profit),
                    'avg_multiplier': round(avg_multiplier, 2),
                    'highest_multiplier': round(highest_multiplier, 2),
                    'preferred_types': potion_data['preferred_types']
                })
            else:
                potion_type_stats.append({
                    'potion_type': potion_key,
                    'potion_name': potion_data['name'],
                    'brew_count': 0,
                    'perfect_brews': 0,
                    'good_brews': 0,
                    'failed_brews': 0,
                    'success_rate': 0,
                    'total_won': 0,
                    'total_bet': 0,
                    'total_profit': 0,
                    'avg_multiplier': 0,
                    'highest_multiplier': 0,
                    'preferred_types': potion_data['preferred_types']
                })
        
        return Response({
            'potion_type_stats': potion_type_stats
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_ingredient_stats(request):
    """
    Get statistics about ingredient usage and performance
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get all brews for the user
        brews = PotionBrew.objects.filter(user=request.user)
        
        ingredient_stats = {}
        total_ingredients_used = 0
        
        for brew in brews:
            for ingredient in brew.ingredients_used:
                ingredient_name = ingredient['name']
                total_ingredients_used += 1
                
                if ingredient_name not in ingredient_stats:
                    ingredient_stats[ingredient_name] = {
                        'name': ingredient_name,
                        'image': ingredient['image'],
                        'type': ingredient['type'],
                        'rarity': ingredient.get('rarity', 'common'),
                        'power': ingredient['power'],
                        'count_used': 0,
                        'in_perfect_brews': 0,
                        'in_good_brews': 0,
                        'in_failed_brews': 0,
                        'total_multiplier_contribution': 0
                    }
                
                stats = ingredient_stats[ingredient_name]
                stats['count_used'] += 1
                
                # Track which success levels this ingredient was used in
                if brew.success_level == 'perfect':
                    stats['in_perfect_brews'] += 1
                elif brew.success_level == 'good':
                    stats['in_good_brews'] += 1
                else:
                    stats['in_failed_brews'] += 1
                
                # Calculate success rate for this ingredient
                success_rate = ((stats['in_perfect_brews'] + stats['in_good_brews']) / stats['count_used'] * 100) if stats['count_used'] > 0 else 0
                stats['success_rate'] = round(success_rate, 2)
        
        # Convert to list and sort by count used
        ingredient_list = list(ingredient_stats.values())
        ingredient_list.sort(key=lambda x: x['count_used'], reverse=True)
        
        return Response({
            'ingredient_stats': ingredient_list,
            'total_ingredients_used': total_ingredients_used
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_alchemist_rank(total_brews, perfect_brews, highest_multiplier):
    """
    Calculate alchemist rank based on total brews, perfect brews, and highest multiplier
    """
    if total_brews >= 100 and perfect_brews >= 25 and highest_multiplier >= 50:
        return "Grand Master Alchemist 🧪"
    elif total_brews >= 50 and perfect_brews >= 10 and highest_multiplier >= 25:
        return "Master Alchemist ⚗️"
    elif total_brews >= 25 and perfect_brews >= 5 and highest_multiplier >= 15:
        return "Expert Potion Master 🔮"
    elif total_brews >= 10 and perfect_brews >= 2:
        return "Seasoned Brewer 🌟"
    elif total_brews >= 5:
        return "Amateur Mixer 💫"
    else:
        return "Novice Apprentice 🎯"