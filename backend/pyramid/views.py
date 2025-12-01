import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Max, Avg
from .models import PyramidExploration, PyramidStats
from accounts.models import User

PYRAMID_CHAMBERS = [
    {'name': 'Entrance Hall', 'danger': 0.1, 'treasure_chance': 0.3, 'image': '🚪'},
    {'name': 'Burial Chamber', 'danger': 0.4, 'treasure_chance': 0.6, 'image': '⚰️'},
    {'name': 'Treasure Room', 'danger': 0.7, 'treasure_chance': 0.8, 'image': '💎'},
    {'name': 'Pharaoh\'s Tomb', 'danger': 0.9, 'treasure_chance': 0.9, 'image': '👑'},
    {'name': 'Secret Passage', 'danger': 0.5, 'treasure_chance': 0.7, 'image': '🕳️'},
    {'name': 'Guardian Room', 'danger': 0.8, 'treasure_chance': 0.5, 'image': '🗡️'},
]

ARTIFACTS = [
    {'name': 'Golden Scarab', 'value': 2.0, 'image': '🐞'},
    {'name': 'Pharaoh Mask', 'value': 3.0, 'image': '🎭'},
    {'name': 'Hieroglyph Tablet', 'value': 1.5, 'image': '📜'},
    {'name': 'Ankh Amulet', 'value': 2.5, 'image': '☥'},
    {'name': 'Sarcophagus', 'value': 5.0, 'image': '⚰️'},
    {'name': 'Royal Scepter', 'value': 4.0, 'image': '🪄'},
]

TRAPS = [
    {'name': 'Arrow Trap', 'damage': 0.3, 'image': '🏹'},
    {'name': 'Pitfall', 'damage': 0.5, 'image': '🕳️'},
    {'name': 'Poison Darts', 'damage': 0.4, 'image': '💉'},
    {'name': 'Rolling Boulder', 'damage': 0.7, 'image': '🪨'},
]

@api_view(['POST'])
def explore_pyramid(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
    except (TypeError, ValueError):
        return Response({'error': 'Invalid bet amount'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            exploration_cost_multiplier = Decimal('1.8')
            total_cost = bet_amount * exploration_cost_multiplier
            
            if user.balance < total_cost:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct exploration cost
            user.balance -= total_cost
            user.save()
            
            # Explore 3-5 chambers
            chambers_to_explore = random.randint(3, 5)
            chambers_explored = []
            artifacts_found = []
            traps_encountered = 0
            survival_multiplier = Decimal('1.0')
            
            for _ in range(chambers_to_explore):
                chamber = random.choice(PYRAMID_CHAMBERS)
                chambers_explored.append(chamber)
                
                # Check for trap
                if random.random() < chamber['danger']:
                    trap = random.choice(TRAPS)
                    traps_encountered += 1
                    survival_multiplier *= Decimal('1.0') - Decimal(str(trap['damage']))
                
                # Check for treasure
                if random.random() < chamber['treasure_chance']:
                    artifact = random.choice(ARTIFACTS)
                    artifacts_found.append(artifact)
                    survival_multiplier *= Decimal(str(artifact['value']))
            
            # Calculate final winnings
            exploration_bonus = Decimal(str(len(chambers_explored) / 2.0))
            final_multiplier = survival_multiplier * exploration_bonus
            win_amount = bet_amount * final_multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            # Create exploration record
            exploration = PyramidExploration.objects.create(
                user=user,
                bet_amount=bet_amount,
                chambers_explored=chambers_explored,
                traps_encountered=traps_encountered,
                artifacts_found=artifacts_found,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = PyramidStats.objects.get_or_create(user=user)
            stats.total_expeditions += 1
            stats.total_bet += total_cost
            stats.total_won += win_amount
            stats.traps_survived += traps_encountered
            stats.total_artifacts += len(artifacts_found)
            stats.chambers_explored_total += len(chambers_explored)
            
            # Update highest multiplier
            if final_multiplier > stats.highest_multiplier:
                stats.highest_multiplier = final_multiplier
            
            stats.save()
            
            return Response({
                'chambers_explored': chambers_explored,
                'traps_encountered': traps_encountered,
                'artifacts_found': artifacts_found,
                'survival_multiplier': float(survival_multiplier),
                'final_multiplier': float(final_multiplier),
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'exploration_id': exploration.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_pyramid_stats(request):
    """
    Get pyramid exploration statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get or create stats for the user
        stats, created = PyramidStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_expeditions = stats.total_expeditions
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        traps_survived = stats.traps_survived
        total_artifacts = stats.total_artifacts
        chambers_explored_total = stats.chambers_explored_total
        highest_multiplier = float(stats.highest_multiplier) if stats.highest_multiplier else 0
        
        # Calculate profit and averages
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        avg_artifacts_per_expedition = total_artifacts / total_expeditions if total_expeditions > 0 else 0
        avg_traps_per_expedition = traps_survived / total_expeditions if total_expeditions > 0 else 0
        avg_chambers_per_expedition = chambers_explored_total / total_expeditions if total_expeditions > 0 else 0
        
        # Calculate survival rate (expeditions with positive profit)
        successful_expeditions = PyramidExploration.objects.filter(
            user=request.user, 
            win_amount__gt=models.F('bet_amount') * Decimal('1.8')  # Account for 1.8x cost multiplier
        ).count()
        survival_rate = (successful_expeditions / total_expeditions * 100) if total_expeditions > 0 else 0
        
        return Response({
            'total_expeditions': total_expeditions,
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'traps_survived': traps_survived,
            'total_artifacts': total_artifacts,
            'chambers_explored_total': chambers_explored_total,
            'highest_multiplier': round(highest_multiplier, 2),
            'avg_artifacts_per_expedition': round(avg_artifacts_per_expedition, 2),
            'avg_traps_per_expedition': round(avg_traps_per_expedition, 2),
            'avg_chambers_per_expedition': round(avg_chambers_per_expedition, 2),
            'survival_rate': round(survival_rate, 2),
            'explorer_rank': calculate_explorer_rank(total_expeditions, total_artifacts)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_pyramid_history(request):
    """
    Get recent pyramid exploration history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 pyramid explorations, most recent first
        explorations = PyramidExploration.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for exploration in explorations:
            # Calculate exploration cost
            exploration_cost_multiplier = Decimal('1.8')
            total_cost = exploration.bet_amount * exploration_cost_multiplier
            profit = exploration.win_amount - total_cost
            
            # Calculate some metrics for this exploration
            chambers_count = len(exploration.chambers_explored)
            artifacts_count = len(exploration.artifacts_found)
            trap_survival_rate = (1 - (exploration.traps_encountered / chambers_count)) * 100 if chambers_count > 0 else 100
            
            history.append({
                'id': exploration.id,
                'bet_amount': float(exploration.bet_amount),
                'total_cost': float(total_cost),
                'win_amount': float(exploration.win_amount),
                'profit': float(profit),
                'chambers_explored': exploration.chambers_explored,
                'chambers_count': chambers_count,
                'traps_encountered': exploration.traps_encountered,
                'artifacts_found': exploration.artifacts_found,
                'artifacts_count': artifacts_count,
                'final_multiplier': float(exploration.win_amount / exploration.bet_amount) if exploration.bet_amount > 0 else 0,
                'trap_survival_rate': round(trap_survival_rate, 2),
                'created_at': exploration.created_at.isoformat(),
                'was_successful': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_artifact_stats(request):
    """
    Get artifact discovery statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get all explorations
        explorations = PyramidExploration.objects.filter(user=request.user)
        
        # Count artifact discoveries
        artifact_counts = {}
        total_artifact_value = Decimal('0.0')
        
        for exploration in explorations:
            for artifact in exploration.artifacts_found:
                artifact_name = artifact['name']
                artifact_value = Decimal(str(artifact['value']))
                
                if artifact_name in artifact_counts:
                    artifact_counts[artifact_name]['count'] += 1
                    artifact_counts[artifact_name]['total_value'] += artifact_value
                else:
                    artifact_counts[artifact_name] = {
                        'count': 1,
                        'total_value': artifact_value,
                        'image': artifact['image'],
                        'value': artifact_value
                    }
                
                total_artifact_value += artifact_value
        
        # Convert to list and sort by count (most common first)
        artifact_stats = []
        for artifact_name, stats in artifact_counts.items():
            artifact_stats.append({
                'name': artifact_name,
                'count': stats['count'],
                'total_value': float(stats['total_value']),
                'image': stats['image'],
                'value': float(stats['value']),
                'percentage': (stats['count'] / sum(item['count'] for item in artifact_counts.values()) * 100) if artifact_counts else 0
            })
        
        # Sort by count descending
        artifact_stats.sort(key=lambda x: x['count'], reverse=True)
        
        # Get most common artifact
        most_common_artifact = artifact_stats[0] if artifact_stats else None
        
        # Get rarest artifact (lowest count)
        rarest_artifact = artifact_stats[-1] if artifact_stats else None
        
        return Response({
            'artifact_stats': artifact_stats,
            'total_artifacts_found': sum(item['count'] for item in artifact_stats),
            'total_artifact_value': float(total_artifact_value),
            'most_common_artifact': most_common_artifact,
            'rarest_artifact': rarest_artifact,
            'unique_artifacts_found': len(artifact_stats)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_chamber_stats(request):
    """
    Get chamber exploration statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get all explorations
        explorations = PyramidExploration.objects.filter(user=request.user)
        
        # Count chamber visits and treasure findings
        chamber_stats = {}
        total_chambers_explored = 0
        total_treasure_found = 0
        
        for exploration in explorations:
            for chamber in exploration.chambers_explored:
                chamber_name = chamber['name']
                
                if chamber_name in chamber_stats:
                    chamber_stats[chamber_name]['visits'] += 1
                    chamber_stats[chamber_name]['treasure_found'] += 1 if any(artifact['name'] for artifact in exploration.artifacts_found) else 0
                else:
                    chamber_stats[chamber_name] = {
                        'visits': 1,
                        'treasure_found': 1 if any(artifact['name'] for artifact in exploration.artifacts_found) else 0,
                        'danger': chamber['danger'],
                        'treasure_chance': chamber['treasure_chance'],
                        'image': chamber['image']
                    }
                
                total_chambers_explored += 1
                if any(artifact['name'] for artifact in exploration.artifacts_found):
                    total_treasure_found += 1
        
        # Convert to list and calculate success rates
        chamber_stats_list = []
        for chamber_name, stats in chamber_stats.items():
            success_rate = (stats['treasure_found'] / stats['visits'] * 100) if stats['visits'] > 0 else 0
            chamber_stats_list.append({
                'name': chamber_name,
                'visits': stats['visits'],
                'treasure_found': stats['treasure_found'],
                'success_rate': round(success_rate, 2),
                'danger': stats['danger'],
                'treasure_chance': stats['treasure_chance'],
                'image': stats['image']
            })
        
        # Sort by visits descending
        chamber_stats_list.sort(key=lambda x: x['visits'], reverse=True)
        
        # Calculate overall treasure finding rate
        overall_treasure_rate = (total_treasure_found / total_chambers_explored * 100) if total_chambers_explored > 0 else 0
        
        return Response({
            'chamber_stats': chamber_stats_list,
            'total_chambers_explored': total_chambers_explored,
            'total_treasure_found': total_treasure_found,
            'overall_treasure_rate': round(overall_treasure_rate, 2),
            'most_visited_chamber': chamber_stats_list[0] if chamber_stats_list else None,
            'most_successful_chamber': max(chamber_stats_list, key=lambda x: x['success_rate']) if chamber_stats_list else None
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_explorer_rank(total_expeditions, total_artifacts):
    """
    Calculate explorer rank based on total expeditions and artifacts found
    """
    if total_expeditions >= 100 and total_artifacts >= 50:
        return "Master Archaeologist 🏺"
    elif total_expeditions >= 50 and total_artifacts >= 25:
        return "Elite Explorer ⚱️"
    elif total_expeditions >= 25 and total_artifacts >= 10:
        return "Seasoned Adventurer 🗿"
    elif total_expeditions >= 10 and total_artifacts >= 5:
        return "Amateur Historian 🔍"
    else:
        return "Novice Explorer 🧭"