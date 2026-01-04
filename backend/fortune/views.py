# fortune/views.py
from __future__ import annotations

import secrets
import uuid
import random
import hashlib
from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.core.signing import TimestampSigner

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import RTPConfig, GameSession, GameRound, GameOutcome
from .serializers import (
    StartSessionIn,
    StartSessionOut,
    SessionStateOut,
    CashoutOut,
    StepIn,
    StepOut,
    GameConfigOut,
    RevealSeedOut,
)
from .wallet import debit_for_bet, credit_payout, WalletError
from .defaults import DEFAULT_RTP


# =====================================================
# GAME CONSTANTS & HELPERS
# =====================================================

def seed_hash(seed: str) -> str:
    """Generate SHA256 hash of seed."""
    return hashlib.sha256(seed.encode()).hexdigest()


# =====================================================
# GAME-SPECIFIC LOGIC
# =====================================================

class FortuneMouseEngine:
    """Fortune Mouse game engine."""
    
    @staticmethod
    def calculate_step(session: GameSession, tile_id: int) -> tuple[str, Decimal, bool]:
        """
        Calculate step result for Fortune Mouse.
        Returns: (result_type, new_multiplier, is_game_over)
        """
        roll = random.random()
        
        # 70% chance to win (increase multiplier)
        if roll < 0.70:
            # Generate multiplier between 0.5x and 3.5x for winning steps
            # Use a distribution that favors lower multipliers for better gameplay
            multiplier_choices = [
                Decimal("0.50"), Decimal("0.75"), Decimal("1.00"), 
                Decimal("1.25"), Decimal("1.50"), Decimal("1.75"),
                Decimal("2.00"), Decimal("2.25"), Decimal("2.50"),
                Decimal("2.75"), Decimal("3.00"), Decimal("3.25"), Decimal("3.50")
            ]
            # Weight lower multipliers more heavily for balanced gameplay
            weights = [0.15, 0.14, 0.13, 0.12, 0.11, 0.10, 
                      0.08, 0.06, 0.04, 0.03, 0.02, 0.01, 0.01]
            
            delta = random.choices(multiplier_choices, weights=weights, k=1)[0]
            new_multiplier = session.current_multiplier + delta
            
            # Ensure multiplier doesn't exceed reasonable bounds
            if new_multiplier > Decimal("10.00"):
                new_multiplier = Decimal("10.00")
            
            return "safe", new_multiplier, False
        
        # 15% chance for penalty (halve multiplier)
        elif roll < 0.85:
            new_multiplier = session.current_multiplier * Decimal("0.5")
            return "penalty", max(new_multiplier, Decimal("0.50")), False
        
        # 10% chance for reset
        elif roll < 0.95:
            return "reset", Decimal("1.00"), False
        
        # 5% chance for trap (game over)
        else:
            return "trap", session.current_multiplier, True


class FortuneTigerEngine:
    """Fortune Tiger game engine - Higher risk, higher rewards."""
    
    @staticmethod
    def calculate_step(session: GameSession, tile_id: int) -> tuple[str, Decimal, bool]:
        roll = random.random()
        
        # 60% chance to win (slightly lower than Mouse for higher risk)
        if roll < 0.60:
            # Higher potential multipliers for Tiger (0.5x to 5.0x)
            multiplier_choices = [
                Decimal("0.50"), Decimal("1.00"), Decimal("1.50"),
                Decimal("2.00"), Decimal("2.50"), Decimal("3.00"),
                Decimal("3.50"), Decimal("4.00"), Decimal("4.50"), Decimal("5.00")
            ]
            # More balanced weights for higher risk game
            weights = [0.10, 0.15, 0.15, 0.14, 0.13, 
                      0.12, 0.08, 0.06, 0.04, 0.03]
            
            delta = random.choices(multiplier_choices, weights=weights, k=1)[0]
            new_multiplier = session.current_multiplier + delta
            
            if new_multiplier > Decimal("15.00"):
                new_multiplier = Decimal("15.00")
            
            return "safe", new_multiplier, False
        
        # 20% chance for minor penalty
        elif roll < 0.80:
            new_multiplier = session.current_multiplier * Decimal("0.7")
            return "penalty", max(new_multiplier, Decimal("0.50")), False
        
        # 10% chance for major penalty
        elif roll < 0.90:
            new_multiplier = session.current_multiplier * Decimal("0.4")
            return "major_penalty", max(new_multiplier, Decimal("0.50")), False
        
        # 8% chance for reset
        elif roll < 0.98:
            return "reset", Decimal("1.00"), False
        
        # 2% chance for instant game over (lower than Mouse for balance)
        else:
            return "trap", session.current_multiplier, True


class FortuneRabbitEngine:
    """Fortune Rabbit game engine - Carrot bonuses, more forgiving."""
    
    @staticmethod
    def calculate_step(session: GameSession, tile_id: int) -> tuple[str, Decimal, bool]:
        roll = random.random()
        
        # 75% chance to win (highest among games)
        if roll < 0.75:
            # Check for carrot bonus (every 3rd step has higher chance)
            has_carrot_bonus = (session.step_index + 1) % 3 == 0
            
            # Rabbit has moderate multipliers (0.5x to 3.0x)
            multiplier_choices = [
                Decimal("0.50"), Decimal("0.75"), Decimal("1.00"),
                Decimal("1.25"), Decimal("1.50"), Decimal("1.75"),
                Decimal("2.00"), Decimal("2.25"), Decimal("2.50"),
                Decimal("2.75"), Decimal("3.00")
            ]
            
            if has_carrot_bonus and roll < 0.60:  # 60% of wins get carrot bonus on 3rd steps
                # Carrot bonus - use higher weighted multipliers
                weights = [0.05, 0.07, 0.09, 0.11, 0.13, 
                          0.15, 0.12, 0.10, 0.08, 0.06, 0.04]
                delta = random.choices(multiplier_choices, weights=weights, k=1)[0]
                new_multiplier = session.current_multiplier + delta
                return "carrot_bonus", new_multiplier, False
            else:
                # Normal safe - favor lower multipliers
                weights = [0.20, 0.18, 0.16, 0.14, 0.12,
                          0.08, 0.05, 0.03, 0.02, 0.01, 0.01]
                delta = random.choices(multiplier_choices, weights=weights, k=1)[0]
                new_multiplier = session.current_multiplier + delta
                return "safe", new_multiplier, False
        
        # 15% chance for minor penalty
        elif roll < 0.90:
            new_multiplier = session.current_multiplier * Decimal("0.8")
            return "penalty", max(new_multiplier, Decimal("0.50")), False
        
        # 8% chance for soft reset
        elif roll < 0.98:
            new_multiplier = max(Decimal("0.50"), session.current_multiplier * Decimal("0.6"))
            return "reset", new_multiplier, False
        
        # 2% chance for trap (lowest among games)
        else:
            return "trap", session.current_multiplier, True


class GameEngineFactory:
    """Factory to get appropriate game engine."""
    
    _engines = {
        "fortune_mouse": FortuneMouseEngine,
        "fortune_tiger": FortuneTigerEngine,
        "fortune_rabbit": FortuneRabbitEngine,
    }
    
    @classmethod
    def get_engine(cls, game_type: str):
        engine_class = cls._engines.get(game_type)
        if not engine_class:
            raise ValueError(f"Unknown game type: {game_type}")
        return engine_class()


# =====================================================
# GAME CONFIGURATIONS
# =====================================================

def get_game_config(game_type: str) -> dict:
    """Get configuration for each game type."""
    configs = {
        "fortune_mouse": {
            "title": "Fortune Mouse",
            "description": "Classic grid adventure with balanced risk-reward",
            "icon": "🐭",
            "grid_size": 20,
            "min_stake": Decimal("100.00"),
            "risk_level": "medium",
            "color": "#4A90E2",
            "character": "🐭",
        },
        "fortune_tiger": {
            "title": "Fortune Tiger",
            "description": "High risk, high reward jungle adventure",
            "icon": "🐯",
            "grid_size": 16,
            "min_stake": Decimal("500.00"),
            "risk_level": "high",
            "color": "#FF6B35",
            "character": "🐯",
        },
        "fortune_rabbit": {
            "title": "Fortune Rabbit",
            "description": "Carrot collection with bonus rounds",
            "icon": "🐰",
            "grid_size": 25,
            "min_stake": Decimal("200.00"),
            "risk_level": "low",
            "color": "#FF69B4",
            "character": "🐰",
        },
    }
    return configs.get(game_type, configs["fortune_mouse"])


# =====================================================
# VIEWS
# =====================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def game_config(request, game_type: str):
    """Get configuration for a specific game."""
    game_config_data = get_game_config(game_type)
    
    # Get RTP config from database
    cfg, _ = RTPConfig.objects.get_or_create(
        game=game_type,
        defaults=DEFAULT_RTP.get(game_type, DEFAULT_RTP["fortune_mouse"])
    )
    
    response_data = {
        "game": game_type,
        "title": game_config_data["title"],
        "description": game_config_data["description"],
        "icon": game_config_data["icon"],
        "grid_size": game_config_data["grid_size"],
        "min_stake": str(game_config_data["min_stake"]),
        "risk_level": game_config_data["risk_level"],
        "color": game_config_data["color"],
        "character": game_config_data["character"],
        "max_steps": cfg.max_steps,
        "max_multiplier": str(cfg.max_multiplier),
        "target_rtp": str(cfg.target_rtp),
    }
    
    return Response(GameConfigOut(response_data).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_session(request):
    """Start a new game session."""
    serializer = StartSessionIn(data=request.data)
    serializer.is_valid(raise_exception=True)

    game = serializer.validated_data["game"]
    bet_amount = serializer.validated_data["bet_amount"]
    client_seed = serializer.validated_data["client_seed"]

    # Get game config
    game_config_data = get_game_config(game)
    
    # Check minimum stake
    if bet_amount < game_config_data["min_stake"]:
        return Response(
            {
                "detail": f"Minimum stake for {game_config_data['title']} is ₦{game_config_data['min_stake']}"
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Get or create RTP config
    defaults = DEFAULT_RTP.get(game)
    if not defaults:
        return Response(
            {"detail": "Invalid game id"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cfg, _ = RTPConfig.objects.get_or_create(game=game, defaults=defaults)

    # Generate seeds
    server_seed = secrets.token_hex(32)
    server_seed_h = seed_hash(server_seed)

    print(f"[Fortune] Creating {game} session: user={request.user.id}, bet={bet_amount}")
    
    try:
        with transaction.atomic():
            # Create session
            session = GameSession.objects.create(
                user=request.user,
                game=game,
                bet_amount=bet_amount,
                server_seed_hash=server_seed_h,
                server_seed=server_seed,
                client_seed=client_seed,
            )
            
            print(f"[Fortune] Session created: id={session.id}")

            # Debit user's wallet
            try:
                debit_for_bet(
                    user_id=request.user.id,
                    amount=bet_amount,
                    ref=f"fortune:{session.id}:bet",
                )
            except WalletError as e:
                return Response(
                    {"detail": str(e)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Prepare response
        response_data = {
            "session_id": str(session.id),
            "game": session.game,
            "game_title": game_config_data["title"],
            "game_icon": game_config_data["icon"],
            "grid_size": game_config_data["grid_size"],
            "bet_amount": str(session.bet_amount),
            "server_seed_hash": session.server_seed_hash,
            "max_steps": cfg.max_steps,
            "max_multiplier": str(cfg.max_multiplier),
            "current_multiplier": str(session.current_multiplier),
            "step_index": session.step_index,
            "min_stake": str(game_config_data["min_stake"]),
            "character": game_config_data["character"],
            "color": game_config_data["color"],
        }
        
        return Response(StartSessionOut(response_data).data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        print(f"[Fortune] Error creating session: {e}")
        return Response(
            {"detail": "Failed to create game session"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_state(request, session_id: uuid.UUID):
    """Get current session state."""
    try:
        session = GameSession.objects.get(
            id=session_id,
            user=request.user,
        )
    except GameSession.DoesNotExist:
        return Response(
            {"detail": "Session not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    response_data = {
        "session_id": session.id,
        "status": session.status,
        "step_index": session.step_index,
        "current_multiplier": str(session.current_multiplier),
        "payout_amount": str(session.payout_amount),
        "game": session.game,
    }
    
    return Response(SessionStateOut(response_data).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def take_step(request, session_id: uuid.UUID):
    """Take a step in the game (reveal a tile)."""
    serializer = StepIn(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    tile_id = serializer.validated_data["tile_id"]
    client_msg_id = serializer.validated_data.get("msg_id", str(uuid.uuid4()))
    
    try:
        with transaction.atomic():
            # Get session with lock
            session = GameSession.objects.select_for_update().get(
                id=session_id,
                user=request.user,
            )
            
            # Check if session is active
            if session.status != GameSession.STATUS_ACTIVE:
                return Response(
                    {"detail": "Session is not active"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Check for duplicate message
            if session.last_client_msg_id:
                try:
                    if uuid.UUID(client_msg_id) == session.last_client_msg_id:
                        return Response({
                            "type": "duplicate",
                            "detail": "Duplicate action"
                        })
                except (ValueError, AttributeError):
                    pass
            
            # Get appropriate game engine
            engine = GameEngineFactory.get_engine(session.game)
            result_type, new_multiplier, is_game_over = engine.calculate_step(session, tile_id)
            
            # Update session
            session.step_index += 1
            session.current_multiplier = new_multiplier
            session.last_client_msg_id = uuid.UUID(client_msg_id)
            
            if is_game_over:
                session.status = GameSession.STATUS_LOST
                session.finished_at = timezone.now()
                payout = Decimal("0.00")
            else:
                # Check if max steps reached
                cfg = RTPConfig.objects.filter(game=session.game).first()
                if cfg and session.step_index >= cfg.max_steps:
                    # Auto-cashout at max steps
                    payout = (session.bet_amount * session.current_multiplier).quantize(Decimal("0.01"))
                    session.payout_amount = payout
                    session.status = GameSession.STATUS_CASHED
                    session.finished_at = timezone.now()
                    result_type = "auto_cashout"
                    
                    # Create outcome record
                    GameOutcome.objects.create(
                        session=session,
                        house_edge=Decimal("0.75"),
                        rtp_used=Decimal("0.25"),
                        win=True,
                        gross_payout=payout,
                        net_profit=payout - session.bet_amount,
                        reason="max_steps_reached",
                    )
                    
                    # Credit wallet (outside transaction)
                    transaction.on_commit(
                        lambda: credit_payout(
                            user_id=session.user_id,
                            payout=payout,
                            ref=f"fortune:{session.id}:auto_cashout"
                        )
                    )
            
            session.save()
            
            # Record the game round
            GameRound.objects.create(
                session=session,
                step=session.step_index,
                client_action="tile_pick",
                client_choice=str(tile_id),
                result=result_type,
                multiplier_after=session.current_multiplier,
                survival_prob_after=Decimal("1.0"),
            )
            
            # Prepare response
            response_data = {
                "type": "step_result",
                "result": result_type,
                "status": session.status,
                "step_index": session.step_index,
                "current_multiplier": str(session.current_multiplier),
                "session_id": str(session.id),
            }
            
            if session.status == GameSession.STATUS_CASHED:
                response_data["payout_amount"] = str(session.payout_amount)
            
            return Response(StepOut(response_data).data)
            
    except GameSession.DoesNotExist:
        return Response(
            {"detail": "Session not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        print(f"[Fortune] Error taking step: {e}")
        return Response(
            {"detail": "Internal server error"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cashout(request, session_id: uuid.UUID):
    """Cash out from an active session."""
    try:
        with transaction.atomic():
            session = GameSession.objects.select_for_update().get(
                id=session_id,
                user=request.user,
            )

            if session.status != GameSession.STATUS_ACTIVE:
                return Response(
                    {"detail": "Session not active"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Calculate payout
            payout = (
                session.bet_amount * session.current_multiplier
            ).quantize(Decimal("0.01"))

            # Update session
            session.payout_amount = payout
            session.status = GameSession.STATUS_CASHED
            session.finished_at = timezone.now()
            session.save()

            # Create outcome record
            GameOutcome.objects.create(
                session=session,
                house_edge=Decimal("0.75"),
                rtp_used=Decimal("0.25"),
                win=True,
                gross_payout=payout,
                net_profit=payout - session.bet_amount,
                reason="cashout",
            )

        # Credit wallet outside transaction
        credit_payout(
            user_id=session.user_id,
            payout=payout,
            ref=f"fortune:{session.id}:cashout",
        )

        response_data = {
            "session_id": session.id,
            "status": session.status,
            "payout_amount": str(session.payout_amount),
            "revealed_server_seed": session.server_seed,
            "current_multiplier": str(session.current_multiplier),
            "step_index": session.step_index,
        }
        
        return Response(CashoutOut(response_data).data)

    except GameSession.DoesNotExist:
        return Response(
            {"detail": "Session not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except Exception as e:
        print(f"[Fortune] Error cashing out: {e}")
        return Response(
            {"detail": "Failed to cash out"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reveal_server_seed(request, session_id: uuid.UUID):
    """Reveal server seed for provable fairness verification."""
    try:
        session = GameSession.objects.get(
            id=session_id,
            user=request.user,
        )
        
        # Only reveal if game is finished
        if session.status not in [
            GameSession.STATUS_CASHED,
            GameSession.STATUS_LOST,
            GameSession.STATUS_EXPIRED
        ]:
            return Response(
                {"detail": "Cannot reveal seed for active session"},
                status=status.HTTP_400_BAD_REQUEST,
            )
            
        response_data = {
            "session_id": str(session.id),
            "server_seed": session.server_seed,
            "client_seed": session.client_seed,
            "server_seed_hash": session.server_seed_hash,
            "final_multiplier": str(session.current_multiplier),
            "final_payout": str(session.payout_amount),
        }
        
        return Response(RevealSeedOut(response_data).data)
        
    except GameSession.DoesNotExist:
        return Response(
            {"detail": "Session not found"},
            status=status.HTTP_404_NOT_FOUND,
        )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def active_sessions(request):
    """Get user's active game sessions."""
    active_sessions = GameSession.objects.filter(
        user=request.user,
        status=GameSession.STATUS_ACTIVE
    ).order_by('-created_at')
    
    sessions_data = []
    for session in active_sessions:
        sessions_data.append({
            "session_id": str(session.id),
            "game": session.game,
            "bet_amount": str(session.bet_amount),
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
            "created_at": session.created_at.isoformat(),
        })
    
    return Response({"sessions": sessions_data})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def abandon_session(request, session_id: uuid.UUID):
    """Abandon an active session (forfeits bet)."""
    try:
        with transaction.atomic():
            session = GameSession.objects.select_for_update().get(
                id=session_id,
                user=request.user,
            )

            if session.status != GameSession.STATUS_ACTIVE:
                return Response(
                    {"detail": "Session not active"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Mark as expired
            session.status = GameSession.STATUS_EXPIRED
            session.finished_at = timezone.now()
            session.save()

            # Create outcome record
            GameOutcome.objects.create(
                session=session,
                house_edge=Decimal("0.75"),
                rtp_used=Decimal("0.25"),
                win=False,
                gross_payout=Decimal("0.00"),
                net_profit=session.bet_amount * -1,
                reason="abandoned",
            )

        return Response({
            "session_id": str(session.id),
            "status": session.status,
            "message": "Session abandoned successfully",
        })

    except GameSession.DoesNotExist:
        return Response(
            {"detail": "Session not found"},
            status=status.HTTP_404_NOT_FOUND,
        )