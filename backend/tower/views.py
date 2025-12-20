import random
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from .models import TowerGame, TowerStats
from wallets.models import Wallet

MAX_PROFIT_RATIO = Decimal("0.30")  # 30%

@api_view(['POST'])
def start_tower(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    try:
        bet_amount = Decimal(str(request.data.get('bet_amount')))
        target_height = int(request.data.get('target_height'))
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    if bet_amount <= 0:
        return Response({'error': 'Invalid stake'}, status=400)

    try:
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)

            if wallet.balance < bet_amount:
                return Response({'error': 'Insufficient balance'}, status=400)

            wallet.balance -= bet_amount
            wallet.save()

            game = TowerGame.objects.create(
                user=request.user,
                bet_amount=bet_amount,
                target_height=target_height,
                current_height=0,
                multiplier=Decimal("1.0"),
                status="building"
            )

            return Response({
                "game_id": game.id,
                "target_height": target_height,
                "new_balance": float(wallet.balance)
            })

    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
def build_level(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    try:
        game_id = request.data.get("game_id")
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    try:
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)
            game = TowerGame.objects.select_for_update().get(
                id=game_id, user=request.user, status="building"
            )

            crash_chance = min(0.15 + (game.current_height * 0.07), 0.85)

            if random.random() < crash_chance:
                game.status = "crashed"
                game.win_amount = Decimal("0")
                game.save()

                TowerStats.objects.get_or_create(user=request.user)[0].total_games += 1

                return Response({
                    "success": False,
                    "status": "crashed",
                    "current_height": game.current_height,
                    "new_balance": float(wallet.balance)
                })

            game.current_height += 1

            raw_multiplier = Decimal("1.0") + (Decimal(game.current_height) * Decimal("0.12"))
            max_allowed_win = game.bet_amount * MAX_PROFIT_RATIO
            capped_multiplier = min(
                raw_multiplier,
                (max_allowed_win / game.bet_amount) + Decimal("1.0")
            )

            game.multiplier = capped_multiplier
            game.save()

            if game.current_height >= game.target_height:
                win_amount = min(
                    game.bet_amount * (game.multiplier - 1),
                    game.bet_amount * MAX_PROFIT_RATIO
                )

                wallet.balance += win_amount
                wallet.save()

                game.status = "completed"
                game.win_amount = win_amount
                game.save()

                stats, _ = TowerStats.objects.get_or_create(user=request.user)
                stats.total_games += 1
                stats.total_won += win_amount
                stats.highest_tower = max(stats.highest_tower, game.current_height)
                stats.save()

                return Response({
                    "success": True,
                    "status": "completed",
                    "current_height": game.current_height,
                    "multiplier": float(game.multiplier),
                    "win_amount": float(win_amount),
                    "new_balance": float(wallet.balance)
                })

            return Response({
                "success": True,
                "status": "building",
                "current_height": game.current_height,
                "multiplier": float(game.multiplier),
                "crash_chance": round(crash_chance * 100, 1)
            })

    except Exception as e:
        return Response({'error': str(e)}, status=500)


@api_view(['POST'])
def cash_out_tower(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)

    try:
        game_id = request.data.get("game_id")
    except:
        return Response({'error': 'Invalid parameters'}, status=400)

    try:
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)
            game = TowerGame.objects.select_for_update().get(
                id=game_id, user=request.user, status="building"
            )

            win_amount = min(
                game.bet_amount * (game.multiplier - 1),
                game.bet_amount * MAX_PROFIT_RATIO
            )

            wallet.balance += win_amount
            wallet.save()

            game.status = "cashed_out"
            game.win_amount = win_amount
            game.save()

            stats, _ = TowerStats.objects.get_or_create(user=request.user)
            stats.total_games += 1
            stats.total_won += win_amount
            stats.highest_tower = max(stats.highest_tower, game.current_height)
            stats.save()

            return Response({
                "win_amount": float(win_amount),
                "multiplier": float(game.multiplier),
                "height_reached": game.current_height,
                "new_balance": float(wallet.balance)
            })

    except Exception as e:
        return Response({'error': str(e)}, status=500)
