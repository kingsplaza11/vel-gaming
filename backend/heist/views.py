import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Max, Count
from .models import CyberHeist, HeistStats
from accounts.models import User

BANKS = [
    {'name': 'Quantum Bank', 'security': 3, 'base_multiplier': 3.0, 'image': '🔒'},
    {'name': 'Neo Financial', 'security': 5, 'base_multiplier': 5.0, 'image': '💳'},
    {'name': 'Cyber Trust', 'security': 7, 'base_multiplier': 8.0, 'image': '🖥️'},
    {'name': 'Digital Vault', 'security': 9, 'base_multiplier': 12.0, 'image': '🏦'},
]

HACKS = [
    {'name': 'Phishing Attack', 'success_rate': 0.7, 'image': '🎣'},
    {'name': 'Brute Force', 'success_rate': 0.5, 'image': '🔨'},
    {'name': 'SQL Injection', 'success_rate': 0.6, 'image': '💉'},
    {'name': 'Zero Day Exploit', 'success_rate': 0.9, 'image': '🕵️'},
    {'name': 'Social Engineering', 'success_rate': 0.8, 'image': '👥'},
]

@api_view(['POST'])
def start_heist(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount', 10)))
        target_bank_name = request.data.get('target_bank', 'Quantum Bank')
    except (TypeError, ValueError):
        return Response({'error': 'Invalid parameters'}, status=status.HTTP_400_BAD_REQUEST)
    
    target_bank = next((bank for bank in BANKS if bank['name'] == target_bank_name), None)
    if not target_bank:
        return Response({'error': 'Invalid target bank'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().get(id=request.user.id)
            
            # Higher security banks cost more to attempt
            cost_multiplier = Decimal(str(target_bank['security'] / 2.0))
            total_cost = bet_amount * cost_multiplier
            
            if user.balance < total_cost:
                return Response({'error': 'Insufficient balance'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Deduct heist cost
            user.balance -= total_cost
            user.save()
            
            # Perform 3 hacks
            hacks_used = []
            total_success = Decimal('0.0')
            escape_success = True
            
            for _ in range(3):
                hack = random.choice(HACKS)
                hacks_used.append(hack)
                
                # Adjust success rate based on bank security
                adjusted_success = hack['success_rate'] * (5.0 / target_bank['security'])
                hack_success = random.random() < adjusted_success
                
                if hack_success:
                    total_success += Decimal(str(hack['success_rate']))
                else:
                    # Failed hack increases chance of getting caught
                    if random.random() < 0.3:
                        escape_success = False
            
            if escape_success:
                # Calculate heist success
                heist_success = total_success / Decimal('3.0')
                final_multiplier = Decimal(str(target_bank['base_multiplier'])) * heist_success
                win_amount = bet_amount * final_multiplier
            else:
                # Caught - lose investment
                win_amount = Decimal('0')
                final_multiplier = Decimal('0')
            
            # Add winnings if successful
            if escape_success:
                user.balance += win_amount
                user.save()
            
            # Create heist record
            heist = CyberHeist.objects.create(
                user=user,
                bet_amount=bet_amount,
                target_bank=target_bank['name'],
                security_level=target_bank['security'],
                hacks_used=hacks_used,
                escape_success=escape_success,
                win_amount=win_amount
            )
            
            # Update stats
            stats, created = HeistStats.objects.get_or_create(user=user)
            stats.total_heists += 1
            stats.total_bet += total_cost
            stats.total_won += win_amount
            stats.total_hacks_attempted += 3
            
            # Update successful heists
            if escape_success:
                stats.successful_heists += 1
            
            # Update highest heist
            if win_amount > stats.highest_heist:
                stats.highest_heist = win_amount
            
            # Update favorite bank (most attempted)
            bank_counts = CyberHeist.objects.filter(user=user).values('target_bank').annotate(count=Count('target_bank')).order_by('-count')
            if bank_counts:
                stats.favorite_bank = bank_counts[0]['target_bank']
            
            stats.save()
            
            return Response({
                'target_bank': target_bank,
                'hacks_used': hacks_used,
                'escape_success': escape_success,
                'final_multiplier': float(final_multiplier),
                'win_amount': float(win_amount),
                'new_balance': float(user.balance),
                'heist_id': heist.id
            })
            
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_heist_stats(request):
    """
    Get cyber heist statistics for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get or create stats for the user
        stats, created = HeistStats.objects.get_or_create(user=request.user)
        
        # Calculate additional statistics
        total_heists = stats.total_heists
        successful_heists = stats.successful_heists
        total_won = float(stats.total_won) if stats.total_won else 0
        total_bet = float(stats.total_bet) if stats.total_bet else 0
        highest_heist = float(stats.highest_heist) if stats.highest_heist else 0
        total_hacks = stats.total_hacks_attempted
        
        # Calculate success rate
        success_rate = (successful_heists / total_heists * 100) if total_heists > 0 else 0
        
        # Calculate profit and ROI
        total_profit = total_won - total_bet
        roi = (total_profit / total_bet * 100) if total_bet > 0 else 0
        
        # Calculate hack success rate
        successful_hacks = CyberHeist.objects.filter(user=request.user).annotate(
            successful_hacks_count=Count('hacks_used')
        ).aggregate(total=Sum('successful_hacks_count'))['total'] or 0
        
        hack_success_rate = (successful_hacks / total_hacks * 100) if total_hacks > 0 else 0
        
        # Get favorite bank info
        favorite_bank = next((bank for bank in BANKS if bank['name'] == stats.favorite_bank), BANKS[0])
        
        return Response({
            'total_heists': total_heists,
            'successful_heists': successful_heists,
            'success_rate': round(success_rate, 2),
            'total_won': round(total_won, 2),
            'total_bet': round(total_bet, 2),
            'total_profit': round(total_profit, 2),
            'roi': round(roi, 2),
            'highest_heist': round(highest_heist, 2),
            'total_hacks_attempted': total_hacks,
            'hack_success_rate': round(hack_success_rate, 2),
            'favorite_bank': favorite_bank,
            'hacker_rank': calculate_hacker_rank(total_heists, success_rate, highest_heist)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_heist_history(request):
    """
    Get recent cyber heist history for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get last 10 heists, most recent first
        heists = CyberHeist.objects.filter(user=request.user).order_by('-created_at')[:10]
        
        history = []
        for heist in heists:
            # Calculate total cost for this heist
            cost_multiplier = Decimal(str(heist.security_level / 2.0))
            total_cost = heist.bet_amount * cost_multiplier
            profit = heist.win_amount - total_cost
            
            # Calculate successful hacks in this heist
            successful_hacks = sum(1 for hack in heist.hacks_used if random.random() < hack['success_rate'] * (5.0 / heist.security_level))
            
            history.append({
                'id': heist.id,
                'target_bank': heist.target_bank,
                'security_level': heist.security_level,
                'bet_amount': float(heist.bet_amount),
                'total_cost': float(total_cost),
                'win_amount': float(heist.win_amount),
                'profit': float(profit),
                'escape_success': heist.escape_success,
                'hacks_used': heist.hacks_used,
                'successful_hacks': successful_hacks,
                'created_at': heist.created_at.isoformat(),
                'was_profitable': profit > 0
            })
        
        return Response({
            'history': history,
            'total_count': len(history)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_bank_stats(request):
    """
    Get statistics per bank for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        bank_stats = []
        
        for bank in BANKS:
            heists = CyberHeist.objects.filter(user=request.user, target_bank=bank['name'])
            heist_count = heists.count()
            
            if heist_count > 0:
                successful_heists = heists.filter(escape_success=True).count()
                total_won = heists.aggregate(Sum('win_amount'))['win_amount__sum'] or Decimal('0')
                total_bet = heists.aggregate(Sum('bet_amount'))['bet_amount__sum'] or Decimal('0')
                
                # Calculate bank-specific costs and profits
                total_cost = total_bet * Decimal(str(bank['security'] / 2.0))
                total_profit = total_won - total_cost
                
                success_rate = (successful_heists / heist_count * 100) if heist_count > 0 else 0
                roi = (total_profit / total_cost * 100) if total_cost > 0 else 0
                
                bank_stats.append({
                    'bank_name': bank['name'],
                    'security_level': bank['security'],
                    'base_multiplier': bank['base_multiplier'],
                    'heist_count': heist_count,
                    'successful_heists': successful_heists,
                    'success_rate': round(success_rate, 2),
                    'total_won': float(total_won),
                    'total_cost': float(total_cost),
                    'total_profit': float(total_profit),
                    'roi': round(float(roi), 2),
                    'image': bank['image']
                })
            else:
                bank_stats.append({
                    'bank_name': bank['name'],
                    'security_level': bank['security'],
                    'base_multiplier': bank['base_multiplier'],
                    'heist_count': 0,
                    'successful_heists': 0,
                    'success_rate': 0,
                    'total_won': 0,
                    'total_cost': 0,
                    'total_profit': 0,
                    'roi': 0,
                    'image': bank['image']
                })
        
        return Response({
            'bank_stats': bank_stats
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_hack_stats(request):
    """
    Get statistics per hack type for the authenticated user
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        hack_stats = []
        
        for hack in HACKS:
            # Count how many times this hack was used in successful heists
            successful_uses = 0
            total_uses = 0
            
            heists = CyberHeist.objects.filter(user=request.user)
            for heist in heists:
                for used_hack in heist.hacks_used:
                    if used_hack['name'] == hack['name']:
                        total_uses += 1
                        # Estimate success based on bank security and hack success rate
                        if random.random() < hack['success_rate'] * (5.0 / heist.security_level):
                            successful_uses += 1
            
            success_rate = (successful_uses / total_uses * 100) if total_uses > 0 else 0
            
            hack_stats.append({
                'hack_name': hack['name'],
                'base_success_rate': hack['success_rate'] * 100,
                'total_uses': total_uses,
                'successful_uses': successful_uses,
                'actual_success_rate': round(success_rate, 2),
                'image': hack['image']
            })
        
        return Response({
            'hack_stats': hack_stats
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_heist_leaderboard(request):
    """
    Get cyber heist leaderboard across all users
    """
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
    
    try:
        # Get top 10 hackers by total winnings
        leaderboard = HeistStats.objects.filter(total_won__gt=0).order_by('-total_won')[:10]
        
        leaderboard_data = []
        for rank, stat in enumerate(leaderboard, 1):
            success_rate = (stat.successful_heists / stat.total_heists * 100) if stat.total_heists > 0 else 0
            
            leaderboard_data.append({
                'rank': rank,
                'username': stat.user.username,
                'total_heists': stat.total_heists,
                'successful_heists': stat.successful_heists,
                'success_rate': round(success_rate, 2),
                'total_won': float(stat.total_won),
                'highest_heist': float(stat.highest_heist),
                'hacker_rank': calculate_hacker_rank(stat.total_heists, success_rate, stat.highest_heist)
            })
        
        # Add current user's position if not in top 10
        user_stats = HeistStats.objects.filter(user=request.user).first()
        if user_stats and user_stats not in leaderboard:
            user_rank = HeistStats.objects.filter(total_won__gt=user_stats.total_won).count() + 1
            user_success_rate = (user_stats.successful_heists / user_stats.total_heists * 100) if user_stats.total_heists > 0 else 0
            
            leaderboard_data.append({
                'rank': user_rank,
                'username': request.user.username,
                'total_heists': user_stats.total_heists,
                'successful_heists': user_stats.successful_heists,
                'success_rate': round(user_success_rate, 2),
                'total_won': float(user_stats.total_won),
                'highest_heist': float(user_stats.highest_heist),
                'hacker_rank': calculate_hacker_rank(user_stats.total_heists, user_success_rate, user_stats.highest_heist),
                'is_current_user': True
            })
        
        return Response({
            'leaderboard': leaderboard_data
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def calculate_hacker_rank(total_heists, success_rate, highest_heist):
    """
    Calculate hacker rank based on total heists, success rate, and highest heist
    """
    if total_heists >= 50 and success_rate >= 80 and highest_heist >= 1000:
        return "Legendary Hacker 🦹"
    elif total_heists >= 25 and success_rate >= 70 and highest_heist >= 500:
        return "Elite Cyber Criminal 💻"
    elif total_heists >= 15 and success_rate >= 60 and highest_heist >= 250:
        return "Professional Hacker 🔓"
    elif total_heists >= 5 and success_rate >= 50 and highest_heist >= 100:
        return "Amateur Hacker 🎭"
    else:
        return "Script Kiddie 🧒"