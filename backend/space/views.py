import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Max, Avg, Count
from .models import SpaceMission, SpaceStats
from accounts.models import User

PLANETS = [
    {'name': 'Mercury', 'type': 'rocky', 'resource_multiplier': 1.2, 'image': '🪐'},
    {'name': 'Venus', 'type': 'volcanic', 'resource_multiplier': 1.5, 'image': '🔥'},
    {'name': 'Mars', 'type': 'desert', 'resource_multiplier': 2.0, 'image': '🔴'},
    {'name': 'Jupiter', 'type': 'gas_giant', 'resource_multiplier': 3.0, 'image': '🟠'},
    {'name': 'Saturn', 'type': 'ringed', 'resource_multiplier': 4.0, 'image': '🪐'},
    {'name': 'Neptune', 'type': 'ice_giant', 'resource_multiplier': 5.0, 'image': '🔵'},
    {'name': 'Exoplanet X', 'type': 'alien', 'resource_multiplier': 8.0, 'image': '👽'},
]

RESOURCES = {
    'mining': [
        {'name': 'Iron Ore', 'value': 1.2, 'image': '⛏️'},
        {'name': 'Gold Nuggets', 'value': 2.0, 'image': '🪙'},
        {'name': 'Diamond Cluster', 'value': 5.0, 'image': '💎'},
        {'name': 'Uranium Core', 'value': 8.0, 'image': '☢️'},
    ],
    'exploration': [
        {'name': 'Alien Artifact', 'value': 3.0, 'image': '🗿'},
        {'name': 'Ancient Ruins', 'value': 4.0, 'image': '🏛️'},
        {'name': 'Cosmic Crystal', 'value': 6.0, 'image': '🔮'},
        {'name': 'Stellar Map', 'value': 10.0, 'image': '🗺️'},
    ],
    'rescue': [
        {'name': 'Lost Astronaut', 'value': 2.5, 'image': '👨‍🚀'},
        {'name': 'Research Data', 'value': 3.5, 'image': '💾'},
        {'name': 'Alien Specimen', 'value': 7.0, 'image': '👾'},
        {'name': 'Time Capsule', 'value': 12.0, 'image': '⏳'},
    ]
}

@api_view(['POST'])
def launch_mission(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        mission_type = request.data.get('mission_type', 'mining')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    if mission_type not in ['mining', 'exploration', 'rescue']:
        return Response({'error': 'Invalid mission type'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            mission_cost_multiplier = Decimal('2.0')  # Space missions are more expensive
            total_cost = bet_amount * mission_cost_multiplier
            
            if user.balance < total_cost:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct mission cost
            user.balance -= total_cost
            user.save()
            
            # Visit 2-4 planets
            planets_visited = random.sample(PLANETS, random.randint(2, 4))
            resources_collected = []
            total_multiplier = Decimal('1.0')
            
            for planet in planets_visited:
                # Collect 1-2 resources per planet
                for _ in range(random.randint(1, 2)):
                    resource = random.choice(RESOURCES[mission_type])
                    planet_bonus = Decimal(str(planet['resource_multiplier']))
                    resource_value = Decimal(str(resource['value'])) * planet_bonus
                    
                    resources_collected.append({
                        **resource,
                        'collected_on': planet['name'],
                        'final_value': float(resource_value)
                    })
                    
                    total_multiplier *= resource_value
            
            win_amount = bet_amount * total_multiplier
            
            # Add winnings
            user.balance += win_amount
            user.save()
            
            # Create mission record
            mission = SpaceMission.objects.create(
                user=user,
                bet_amount=bet_amount,
                mission_type=mission_type,
                planets_visited=planets_visited,
                resources_collected=resources_collected,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = SpaceStats.objects.get_or_create(user=user)
            stats.total_missions += 1
            stats.total_bet += total_cost
            stats.total_won += win_amount
            stats.planets_discovered += len(planets_visited)
            stats.total_resources += len(resources_collected)
            
            # Update mission type counter
            if mission_type == 'mining':
                stats.mining_missions += 1
            elif mission_type == 'exploration':
                stats.exploration_missions += 1
            elif mission_type == 'rescue':
                stats.rescue_missions += 1
            
            # Update highest multiplier
            if total_multiplier > stats.highest_multiplier:
                stats.highest_multiplier = total_multiplier
            
            stats.save()
            
            return Response({
                'mission_type': mission_type,
                'planets_visited': planets_visited,
                'resources_collected': resources_collected,
                'total_multiplier': float(total_multiplier),
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'mission_id': mission.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_space_stats(request):
    """
    Get space mission statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get or create stats for the user
        stats, created = SpaceStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_missions = stats.total_missions
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        planets_discovered = stats.planets_discovered
        total_resources = stats.total_resources
        highest_multiplier = float(stats.highest_multiplier) if stats.highest_multiplier else 0
        
        # Calculate profit and averages
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        avg_planets_per_mission = planets_discovered / total_missions if total_missions > 0 else 0
        avg_resources_per_mission = total_resources / total_missions if total_missions > 0 else 0
        avg_resource_value = total_won / total_resources if total_resources > 0 else 0
        
        # Calculate mission type distribution
        mission_distribution = {
            'mining': stats.mining_missions,
            'exploration': stats.exploration_missions,
            'rescue': stats.rescue_missions
        }
        total_mission_types = sum(mission_distribution.values())
        
        if total_mission_types > 0:
            mission_percentages = {
                mission_type: (count / total_mission_types * 100)
                for mission_type, count in mission_distribution.items()
            }
        else:
            mission_percentages = {'mining': 0, 'exploration': 0, 'rescue': 0}
        
        # Calculate success rate (missions with positive profit)
        successful_missions = SpaceMission.objects.filter(
            user=request.user, 
            win_amount__gt=models.F('bet_amount') * Decimal('2.0')  # Account for 2.0x cost multiplier
        ).count()
        success_rate = (successful_missions / total_missions * 100) if total_missions > 0 else 0
        
        return Response({
            'total_missions': total_missions,
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'planets_discovered': planets_discovered,
            'total_resources': total_resources,
            'highest_multiplier': round(highest_multiplier, 2),
            'avg_planets_per_mission': round(avg_planets_per_mission, 2),
            'avg_resources_per_mission': round(avg_resources_per_mission, 2),
            'avg_resource_value': round(avg_resource_value, 2),
            'mission_distribution': mission_distribution,
            'mission_percentages': mission_percentages,
            'success_rate': round(success_rate, 2),
            'captain_rank': calculate_captain_rank(total_missions, planets_discovered)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_space_history(request):
    """
    Get recent space mission history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 space missions, most recent first
        missions = SpaceMission.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for mission in missions:
            # Calculate mission cost
            mission_cost_multiplier = Decimal('2.0')
            total_cost = mission.bet_amount * mission_cost_multiplier
            profit = mission.win_amount - total_cost
            
            # Calculate mission metrics
            planets_count = len(mission.planets_visited)
            resources_count = len(mission.resources_collected)
            avg_planet_value = mission.win_amount / planets_count if planets_count > 0 else 0
            
            history.append({
                'id': mission.id,
                'mission_type': mission.mission_type,
                'bet_amount': float(mission.bet_amount),
                'total_cost': float(total_cost),
                'win_amount': float(mission.win_amount),
                'profit': float(profit),
                'planets_visited': mission.planets_visited,
                'planets_count': planets_count,
                'resources_collected': mission.resources_collected,
                'resources_count': resources_count,
                'total_multiplier': float(mission.win_amount / mission.bet_amount) if mission.bet_amount > 0 else 0,
                'avg_planet_value': round(float(avg_planet_value), 2),
                'created_at': mission.created_at.isoformat(),
                'was_successful': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_mission_type_stats(request):
    """
    Get statistics per mission type for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        mission_types = ['mining', 'exploration', 'rescue']
        mission_stats = []
        
        for mission_type in mission_types:
            missions = SpaceMission.objects.filter(user=request.user, mission_type=mission_type)
            mission_count = missions.count()
            
            if mission_count > 0:
                total_won = missions.aggregate(Sum('win_amount'))['win_amount__sum'] or Decimal('0')
                total_bet = missions.aggregate(Sum('bet_amount'))['bet_amount__sum'] or Decimal('0')
                avg_multiplier = missions.aggregate(Avg('win_amount'))['win_amount__avg'] or Decimal('0')
                highest_multiplier = missions.aggregate(Max('win_amount'))['win_amount__max'] or Decimal('0')
                
                # Calculate mission cost and profit
                mission_cost_multiplier = Decimal('2.0')
                total_cost = total_bet * mission_cost_multiplier
                total_profit = total_won - total_cost
                
                # Calculate average resources per mission
                total_resources = sum(len(mission.resources_collected) for mission in missions)
                avg_resources = total_resources / mission_count
                
                mission_stats.append({
                    'mission_type': mission_type,
                    'mission_count': mission_count,
                    'total_won': float(total_won),
                    'total_cost': float(total_cost),
                    'total_profit': float(total_profit),
                    'avg_multiplier': float(avg_multiplier / total_bet) if total_bet > 0 else 0,
                    'highest_multiplier': float(highest_multiplier / (total_bet / mission_count)) if mission_count > 0 else 0,
                    'avg_resources_per_mission': round(avg_resources, 2),
                    'mission_type_name': get_mission_type_name(mission_type),
                    'mission_icon': get_mission_icon(mission_type)
                })
            else:
                mission_stats.append({
                    'mission_type': mission_type,
                    'mission_count': 0,
                    'total_won': 0,
                    'total_cost': 0,
                    'total_profit': 0,
                    'avg_multiplier': 0,
                    'highest_multiplier': 0,
                    'avg_resources_per_mission': 0,
                    'mission_type_name': get_mission_type_name(mission_type),
                    'mission_icon': get_mission_icon(mission_type)
                })
        
        return Response({
            'mission_stats': mission_stats
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_planet_stats(request):
    """
    Get planet exploration statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get all missions
        missions = SpaceMission.objects.filter(user=request.user)
        
        # Count planet visits and resource findings
        planet_stats = {}
        total_planet_visits = 0
        total_resources_found = 0
        
        for mission in missions:
            for planet in mission.planets_visited:
                planet_name = planet['name']
                
                if planet_name in planet_stats:
                    planet_stats[planet_name]['visits'] += 1
                    planet_stats[planet_name]['resources_found'] += len([r for r in mission.resources_collected if r['collected_on'] == planet_name])
                else:
                    planet_stats[planet_name] = {
                        'visits': 1,
                        'resources_found': len([r for r in mission.resources_collected if r['collected_on'] == planet_name]),
                        'type': planet['type'],
                        'resource_multiplier': planet['resource_multiplier'],
                        'image': planet['image']
                    }
                
                total_planet_visits += 1
                total_resources_found += len([r for r in mission.resources_collected if r['collected_on'] == planet_name])
        
        # Convert to list and calculate efficiency
        planet_stats_list = []
        for planet_name, stats in planet_stats.items():
            efficiency = (stats['resources_found'] / stats['visits']) if stats['visits'] > 0 else 0
            planet_stats_list.append({
                'name': planet_name,
                'visits': stats['visits'],
                'resources_found': stats['resources_found'],
                'efficiency': round(efficiency, 2),
                'type': stats['type'],
                'resource_multiplier': stats['resource_multiplier'],
                'image': stats['image']
            })
        
        # Sort by visits descending
        planet_stats_list.sort(key=lambda x: x['visits'], reverse=True)
        
        # Calculate overall resource efficiency
        overall_efficiency = (total_resources_found / total_planet_visits) if total_planet_visits > 0 else 0
        
        # Find most visited and most efficient planets
        most_visited_planet = planet_stats_list[0] if planet_stats_list else None
        most_efficient_planet = max(planet_stats_list, key=lambda x: x['efficiency']) if planet_stats_list else None
        
        return Response({
            'planet_stats': planet_stats_list,
            'total_planet_visits': total_planet_visits,
            'total_resources_found': total_resources_found,
            'overall_efficiency': round(overall_efficiency, 2),
            'most_visited_planet': most_visited_planet,
            'most_efficient_planet': most_efficient_planet,
            'unique_planets_discovered': len(planet_stats_list)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_resource_stats(request):
    """
    Get resource collection statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get all missions
        missions = SpaceMission.objects.filter(user=request.user)
        
        # Count resource collections
        resource_counts = {}
        total_resource_value = Decimal('0.0')
        
        for mission in missions:
            for resource in mission.resources_collected:
                resource_name = resource['name']
                resource_value = Decimal(str(resource.get('final_value', resource['value'])))
                
                if resource_name in resource_counts:
                    resource_counts[resource_name]['count'] += 1
                    resource_counts[resource_name]['total_value'] += resource_value
                else:
                    resource_counts[resource_name] = {
                        'count': 1,
                        'total_value': resource_value,
                        'image': resource['image'],
                        'base_value': Decimal(str(resource['value'])),
                        'mission_type': mission.mission_type
                    }
                
                total_resource_value += resource_value
        
        # Convert to list and calculate averages
        resource_stats = []
        for resource_name, stats in resource_counts.items():
            avg_value = stats['total_value'] / stats['count']
            resource_stats.append({
                'name': resource_name,
                'count': stats['count'],
                'total_value': float(stats['total_value']),
                'avg_value': float(avg_value),
                'image': stats['image'],
                'base_value': float(stats['base_value']),
                'mission_type': stats['mission_type'],
                'percentage': (stats['count'] / sum(item['count'] for item in resource_counts.values()) * 100) if resource_counts else 0
            })
        
        # Sort by count descending
        resource_stats.sort(key=lambda x: x['count'], reverse=True)
        
        # Find most common and most valuable resources
        most_common_resource = resource_stats[0] if resource_stats else None
        most_valuable_resource = max(resource_stats, key=lambda x: x['avg_value']) if resource_stats else None
        
        return Response({
            'resource_stats': resource_stats,
            'total_resources_collected': sum(item['count'] for item in resource_stats),
            'total_resource_value': float(total_resource_value),
            'most_common_resource': most_common_resource,
            'most_valuable_resource': most_valuable_resource,
            'unique_resources_found': len(resource_stats)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_captain_rank(total_missions, planets_discovered):
    """
    Calculate captain rank based on total missions and planets discovered
    """
    if total_missions >= 100 and planets_discovered >= 50:
        return "Fleet Admiral 🌟"
    elif total_missions >= 50 and planets_discovered >= 25:
        return "Starship Captain 🚀"
    elif total_missions >= 25 and planets_discovered >= 15:
        return "Experienced Pilot 👨‍🚀"
    elif total_missions >= 10 and planets_discovered >= 5:
        return "Space Cadet 🛰️"
    else:
        return "Rookie Astronaut 🪐"

def get_mission_type_name(mission_type):
    """
    Get the display name for each mission type
    """
    mission_names = {
        'mining': 'Resource Mining',
        'exploration': 'Planetary Exploration',
        'rescue': 'Rescue Operations'
    }
    return mission_names.get(mission_type, mission_type.title())

def get_mission_icon(mission_type):
    """
    Get the icon for each mission type
    """
    mission_icons = {
        'mining': '⛏️',
        'exploration': '🔭',
        'rescue': '🚀'
    }
    return mission_icons.get(mission_type, '🛸')