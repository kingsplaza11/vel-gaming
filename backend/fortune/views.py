# fortune/views.py
from __future__ import annotations

import secrets
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.core.signing import TimestampSigner

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import RTPConfig, GameSession
from .serializers import (
    StartSessionIn,
    StartSessionOut,
    SessionStateOut,
    CashoutOut,
)
from .engine import seed_hash
from .wallet import debit_for_bet, credit_payout, WalletError
from .defaults import DEFAULT_RTP


# =====================================================
# WS TOKEN
# =====================================================

signer = TimestampSigner(salt="fortune-ws")


def sign_ws_token(user_id: int, session_id: str, server_nonce: str) -> str:
    payload = f"{user_id}:{session_id}:{server_nonce}"
    return signer.sign(payload)


def verify_ws_token(token: str, max_age: int = 120) -> tuple[int, str, str]:
    raw = signer.unsign(token, max_age=max_age)
    user_id_s, session_id, nonce = raw.split(":")
    return int(user_id_s), session_id, nonce


# =====================================================
# START SESSION (CRITICAL FIX)
# =====================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_session(request):
    serializer = StartSessionIn(data=request.data)
    serializer.is_valid(raise_exception=True)

    game = serializer.validated_data["game"]
    bet_amount = serializer.validated_data["bet_amount"]
    client_seed = serializer.validated_data["client_seed"]

    defaults = DEFAULT_RTP.get(game)
    if not defaults:
        return Response({"detail": "Invalid game id"}, status=400)

    cfg, _ = RTPConfig.objects.get_or_create(game=game, defaults=defaults)

    server_seed = secrets.token_hex(32)
    server_seed_h = seed_hash(server_seed)

    with transaction.atomic():
        session = GameSession.objects.create(
            user=request.user,
            game=game,
            bet_amount=bet_amount,
            server_seed_hash=server_seed_h,
            server_seed=server_seed,
            client_seed=client_seed,
        )

        # 🔑 MUST REFRESH (DB-generated fields)
        session.refresh_from_db()

        debit_for_bet(
            request.user.id,
            bet_amount,
            ref=f"fortune:{session.id}:bet",
        )

    # ✅ SAFE: transaction already committed here
    ws_token = sign_ws_token(
        request.user.id,
        str(session.id),
        str(session.server_nonce),
    )

    return Response({
        "session_id": str(session.id),
        "game": session.game,
        "bet_amount": str(session.bet_amount),
        "ws_token": ws_token,
        "server_seed_hash": session.server_seed_hash,
        "max_steps": cfg.max_steps,
        "max_multiplier": cfg.max_multiplier,
    }, status=201)


# =====================================================
# SESSION STATE (REFRESH / RECONNECT)
# =====================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def session_state(request, session_id):
    try:
        s = GameSession.objects.get(
            id=session_id,
            user=request.user,
        )
    except GameSession.DoesNotExist:
        return Response(
            {"detail": "Session not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        SessionStateOut({
            "session_id": s.id,
            "status": s.status,
            "step_index": s.step_index,
            "current_multiplier": s.current_multiplier,
            "payout_amount": s.payout_amount,
        }).data
    )


# =====================================================
# CASHOUT (REST FALLBACK)
# =====================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cashout(request, session_id):
    try:
        with transaction.atomic():
            s = GameSession.objects.select_for_update().get(
                id=session_id,
                user=request.user,
            )

            if s.status != GameSession.STATUS_ACTIVE:
                return Response(
                    {"detail": "Session not active"},
                    status=400,
                )

            if s.step_index <= 0:
                s.status = GameSession.STATUS_CASHED
                s.finished_at = timezone.now()
                s.payout_amount = Decimal("0.00")
                s.save(
                    update_fields=[
                        "status",
                        "finished_at",
                        "payout_amount",
                    ]
                )
            else:
                payout = (
                    s.bet_amount * s.current_multiplier
                ).quantize(Decimal("0.01"))

                s.payout_amount = payout
                s.status = GameSession.STATUS_CASHED
                s.finished_at = timezone.now()
                s.save(
                    update_fields=[
                        "payout_amount",
                        "status",
                        "finished_at",
                    ]
                )

        # Wallet credit OUTSIDE transaction
        if s.payout_amount > 0:
            credit_payout(
                user_id=s.user_id,
                payout=s.payout_amount,
                ref=f"fortune:{s.id}:cashout",
            )

    except GameSession.DoesNotExist:
        return Response(
            {"detail": "Session not found"},
            status=404,
        )

    return Response(
        CashoutOut({
            "session_id": s.id,
            "status": s.status,
            "payout_amount": s.payout_amount,
            "revealed_server_seed": s.server_seed,
        }).data
    )
