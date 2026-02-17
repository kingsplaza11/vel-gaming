# guessing/views.py
import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from .models import GuessingGame, GuessingStats
from wallets.models import Wallet

MIN_BET = Decimal("100.00")

# ================= WIN RATIO LOGIC =================
def get_guessing_win_ratio(multiplier, max_number, attempts_used, max_attempts):
    """
    Calculate dynamic win ratio for number guessing game:
    - multiplier: current game multiplier
    - max_number: range size (larger range = harder = better rewards)
    - attempts_used: number of attempts made
    - max_attempts: total attempts allowed
    
    Higher multipliers, larger ranges, and fewer attempts used 
    increase chances of better win ratios.
    """
    # Base probabilities
    rand = random.random() * 100
    
    # Difficulty factor: larger range = harder = better rewards
    difficulty_factor = min(max_number / 500, 1.0)  # Cap at 1.0
    
    # Performance factor: fewer attempts = better performance
    if max_attempts > 0:
        performance_factor = 1 - (attempts_used / max_attempts)
    else:
        performance_factor = 1.0
    
    # Base win tier probabilities
    if rand <= 20:  # 20% chance: Lower tier (10-30%)
        base_ratio = random.uniform(0.10, 0.30)
    elif rand <= 70:  # 50% chance: Normal tier (31-50%)
        base_ratio = random.uniform(0.31, 0.50)
    elif rand <= 90:  # 20% chance: High tier (51-100%)
        base_ratio = random.uniform(0.51, 1.00)
    elif rand <= 97:  # 7% chance: Jackpot tier (101-200%)
        base_ratio = random.uniform(1.01, 2.00)
    else:  # 3% chance: Mega jackpot (201-350%)
        base_ratio = random.uniform(2.01, 3.50)
    
    # Apply bonuses
    final_ratio = base_ratio * (1 + difficulty_factor * 0.6 + performance_factor * 0.4)
    
    # Cap at 400% maximum (rare but possible)
    return min(final_ratio, 4.0)


# ================= START GAME =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_guessing(request):
    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        max_number = int(request.data.get('max_number', 100))
        max_attempts = int(request.data.get('max_attempts', 10))
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    if bet_amount < MIN_BET:
        return Response({'error': f'Minimum stake is ₦{MIN_BET}'}, status=400)

    if max_number < 10 or max_number > 1000:
        return Response({'error': 'Max number must be between 10 and 1000'}, status=400)

    if max_attempts < 3 or max_attempts > 20:
        return Response({'error': 'Max attempts must be between 3 and 20'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        # Check combined balance
        combined_balance = wallet.balance + wallet.spot_balance
        
        if combined_balance < bet_amount:
            return Response({'error': 'Insufficient balance (wallet + spot)'}, status=400)

        remaining_cost = bet_amount
        taken_from_wallet = Decimal('0')
        taken_from_spot = Decimal('0')

        # Deduct from wallet balance first
        if wallet.balance > 0:
            taken_from_wallet = min(wallet.balance, remaining_cost)
            wallet.balance -= taken_from_wallet
            remaining_cost -= taken_from_wallet

        # If still remaining, deduct from spot balance
        if remaining_cost > 0 and wallet.spot_balance > 0:
            taken_from_spot = min(wallet.spot_balance, remaining_cost)
            wallet.spot_balance -= taken_from_spot
            remaining_cost -= taken_from_spot

        wallet.save(update_fields=["balance", "spot_balance"])

        # Generate target number
        target_number = random.randint(1, max_number)

        game = GuessingGame.objects.create(
            user=request.user,
            bet_amount=bet_amount,
            target_number=target_number,
            max_number=max_number,
            max_attempts=max_attempts,
            attempts=0,
            multiplier=Decimal("1.0"),
            status="playing"
        )

        return Response({
            "game_id": game.id,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
            "combined_balance": float(wallet.balance + wallet.spot_balance),
            "max_number": max_number,
            "max_attempts": max_attempts
        })


# ================= MAKE GUESS =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def make_guess(request):
    try:
        game_id = request.data.get("game_id")
        guess = int(request.data.get("guess"))
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        game = GuessingGame.objects.select_for_update().get(
            id=game_id, user=request.user, status="playing"
        )

        game.attempts += 1

        if guess == game.target_number:
            # Calculate multiplier based on remaining attempts
            remaining = game.max_attempts - game.attempts
            base_multiplier = Decimal("1.0")
            
            # Higher multiplier for fewer attempts used
            multiplier_bonus = (Decimal(remaining) / Decimal(game.max_attempts)) * Decimal("4.0")
            difficulty_bonus = Decimal(str(game.max_number / 200))  # Larger range = bigger bonus
            
            raw_multiplier = base_multiplier + multiplier_bonus + difficulty_bonus
            game.multiplier = raw_multiplier

            # Calculate dynamic win ratio
            win_ratio = get_guessing_win_ratio(
                float(raw_multiplier),
                game.max_number,
                game.attempts,
                game.max_attempts
            )
            
            # Calculate win amount
            win_amount = (game.bet_amount * Decimal(str(win_ratio))).quantize(Decimal("0.01"))
            
            # Add speed bonus (guessed quickly)
            if game.attempts <= 3:
                speed_bonus = Decimal("0.3")  # 30% bonus for guessing in 3 attempts or less
                win_amount = win_amount * (Decimal("1.0") + speed_bonus)
            
            # Determine win tier
            win_tier = "normal"
            if win_ratio > 0:
                if win_ratio <= 0.30:
                    win_tier = "low"
                elif win_ratio <= 0.50:
                    win_tier = "normal"
                elif win_ratio <= 1.00:
                    win_tier = "high"
                elif win_ratio <= 2.00:
                    win_tier = "jackpot"
                else:
                    win_tier = "mega_jackpot"

            # Credit winnings to spot_balance
            wallet.spot_balance += win_amount
            wallet.save(update_fields=["spot_balance"])

            game.win_amount = win_amount
            game.win_ratio = win_ratio
            game.status = "won"
            game.save()

            stats, _ = GuessingStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.games_won += 1
            stats.total_won += win_amount
            stats.highest_multiplier = max(stats.highest_multiplier, raw_multiplier)
            if win_ratio > stats.highest_win_ratio:
                stats.highest_win_ratio = win_ratio
            stats.save()

            return Response({
                "status": "won",
                "correct": True,
                "win_amount": float(win_amount),
                "win_ratio": float(win_ratio),
                "win_tier": win_tier,
                "multiplier": float(raw_multiplier),
                "attempts_used": game.attempts,
                "target_number": game.target_number,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
                "combined_balance": float(wallet.balance + wallet.spot_balance)
            })

        # GUESS WRONG
        if game.attempts >= game.max_attempts:
            game.status = "lost"
            game.win_amount = Decimal("0")
            game.win_ratio = 0.0
            game.save()

            stats, _ = GuessingStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.save()

            return Response({
                "status": "lost",
                "correct": False,
                "target_number": game.target_number,
                "attempts_used": game.attempts,
                "wallet_balance": float(wallet.balance),
                "spot_balance": float(wallet.spot_balance),
            })

        game.save()

        
        # Calculate proximity hint (hot/cold)
        difference = abs(guess - game.target_number)
        proximity = difference / game.max_number
        
        proximity_hint = ""
        if proximity < 0.05:
            proximity_hint = "🔥 Very Hot!"
        elif proximity < 0.1:
            proximity_hint = "Hot!"
        elif proximity < 0.2:
            proximity_hint = "Warm"
        elif proximity < 0.4:
            proximity_hint = "Cool"
        else:
            proximity_hint = "❄️ Cold"

        return Response({
            "status": "playing",
            "correct": False,
            "proximity_hint": proximity_hint,
            "difference": difference,
            "attempts": game.attempts,
            "remaining_attempts": game.max_attempts - game.attempts,
            "wallet_balance": float(wallet.balance),
            "spot_balance": float(wallet.spot_balance),
        })


# ================= STATS =================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_guessing_stats(request):
    stats, _ = GuessingStats.objects.get_or_create(user=request.user)
    
    # Get win distribution
    games = GuessingGame.objects.filter(user=request.user, win_amount__gt=0)
    
    low_wins = games.filter(win_ratio__lte=0.30).count()
    normal_wins = games.filter(win_ratio__gt=0.30, win_ratio__lte=0.50).count()
    high_wins = games.filter(win_ratio__gt=0.50, win_ratio__lte=1.00).count()
    jackpot_wins = games.filter(win_ratio__gt=1.00, win_ratio__lte=2.00).count()
    mega_jackpot_wins = games.filter(win_ratio__gt=2.00).count()

    win_rate = (stats.games_won / stats.total_games * 100) if stats.total_games else 0

    return Response({
        'total_games': stats.total_games,
        'games_won': stats.games_won,
        'win_rate': round(win_rate, 2),
        'total_won': round(float(stats.total_won), 2),
        'highest_multiplier': float(stats.highest_multiplier),
        'highest_win_ratio': float(stats.highest_win_ratio or 0),
        'avg_win_per_game': round(float(stats.total_won) / stats.games_won, 2) if stats.games_won else 0,
        'win_distribution': {
            'low': low_wins,
            'normal': normal_wins,
            'high': high_wins,
            'jackpot': jackpot_wins,
            'mega_jackpot': mega_jackpot_wins
        }
    })


# ================= HISTORY =================
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_guessing_history(request):
    games = GuessingGame.objects.filter(user=request.user).order_by('-created_at')[:10]

    history = []
    for game in games:
        profit = game.win_amount - game.bet_amount
        
        # Determine win tier
        win_tier = "loss"
        if game.win_ratio > 0:
            if game.win_ratio <= 0.30:
                win_tier = "low"
            elif game.win_ratio <= 0.50:
                win_tier = "normal"
            elif game.win_ratio <= 1.00:
                win_tier = "high"
            elif game.win_ratio <= 2.00:
                win_tier = "jackpot"
            else:
                win_tier = "mega_jackpot"

        history.append({
            'id': game.id,
            'bet_amount': float(game.bet_amount),
            'win_amount': float(game.win_amount),
            'win_ratio': float(game.win_ratio),
            'win_tier': win_tier,
            'target_number': game.target_number,
            'max_number': game.max_number,
            'attempts': game.attempts,
            'max_attempts': game.max_attempts,
            'multiplier': float(game.multiplier),
            'status': game.status,
            'profit': float(profit),
            'created_at': game.created_at.isoformat(),
            'was_profitable': profit > 0,
        })

    return Response({
        'history': history,
        'total_count': len(history),
    })


# ================= HINT =================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_hint(request):
    """Get a more detailed hint (costs something or limited use)"""
    try:
        game_id = request.data.get("game_id")
    except:
        return Response({'error': 'Invalid game ID'}, status=400)

    try:
        game = GuessingGame.objects.get(id=game_id, user=request.user, status="playing")
        
        # Calculate hint based on previous guesses
        # For now, just give a range hint
        range_size = game.max_number // 4
        
        # Provide a smaller range as hint
        lower_bound = max(1, game.target_number - range_size)
        upper_bound = min(game.max_number, game.target_number + range_size)
        
        return Response({
            'hint': f"The number is between {lower_bound} and {upper_bound}",
            'lower_bound': lower_bound,
            'upper_bound': upper_bound,
            'cost': 0,  # Could charge a small fee for hints
        })
        
    except GuessingGame.DoesNotExist:
        return Response({'error': 'Game not found'}, status=400)