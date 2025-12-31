# fortune/consumers.py
from __future__ import annotations

import uuid
import random
import traceback
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from .models import GameSession, GameRound, GameOutcome
from .views import verify_ws_token
from .wallet import credit_payout

MIN_MULTIPLIER = Decimal("0.45")
BASE_SAFE_PROB = Decimal("0.55")


class FortuneConsumer(AsyncJsonWebsocketConsumer):

    # ======================================================
    # CONNECTION
    # ======================================================
    async def connect(self):
        await self.accept()

        self.user_id = None
        self.session_id = None
        self.authenticated = False

        await self.send_json({
            "type": "connected",
            "message": "Connected to Fortune Mouse"
        })

    # ======================================================
    # RECEIVE
    # ======================================================
    async def receive_json(self, content, **kwargs):
        try:
            msg_type = content.get("type")

            if msg_type == "ping":
                await self.send_json({"type": "pong"})
                return

            if msg_type == "join":
                await self.handle_join(content)
            elif msg_type == "step":
                await self.handle_step(content)
            elif msg_type == "cashout":
                await self.handle_cashout(content)
            else:
                await self.send_json({
                    "type": "error",
                    "code": "invalid_message",
                    "message": "Unknown message type"
                })

        except Exception as e:
            traceback.print_exc()
            await self.send_json({
                "type": "error",
                "code": "server_error",
                "message": str(e)
            })

    # ======================================================
    # JOIN
    # ======================================================
    async def handle_join(self, content):
        token = content.get("ws_token")
        if not token:
            await self.send_json({
                "type": "error",
                "code": "missing_token",
                "message": "Missing token"
            })
            return

        try:
            user_id, session_id, nonce = await database_sync_to_async(
                verify_ws_token
            )(token, 120)
        except Exception:
            await self.send_json({
                "type": "error",
                "code": "auth_failed",
                "message": "Authentication failed"
            })
            await self.close(code=4001)
            return

        session = await self._bind_session(user_id, session_id, nonce)
        if not session:
            await self.close(code=4002)
            return

        self.user_id = user_id
        self.session_id = session.id
        self.authenticated = True

        await self.send_json({
            "type": "joined",
            "session_id": str(session.id),
            "game": "fortune_mouse",
            "status": session.status,
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
            "payout_amount": str(session.payout_amount),
        })

    # ======================================================
    # STEP
    # ======================================================
    async def handle_step(self, content):
        if not self.authenticated:
            return

        result = await self._process_step(
            msg_id=content.get("msg_id"),
            action=content.get("action"),
            choice=content.get("choice"),
            user_id=self.user_id,
            session_id=self.session_id,
        )

        await self.send_json(result)

    # ======================================================
    # CASHOUT
    # ======================================================
    async def handle_cashout(self, content):
        if not self.authenticated:
            return

        result = await self._process_cashout(
            msg_id=content.get("msg_id"),
            user_id=self.user_id,
            session_id=self.session_id,
        )

        await self.send_json(result)

    # ======================================================
    # SAFE DATABASE METHODS
    # ======================================================

    @database_sync_to_async
    def _bind_session(self, user_id, session_id, nonce):
        try:
            session = GameSession.objects.get(id=session_id, user_id=user_id)
            if str(session.server_nonce) != str(nonce):
                return None
            return session
        except GameSession.DoesNotExist:
            return None

    @database_sync_to_async
    def _process_step(self, msg_id, action, choice, user_id, session_id):
        msg_uuid = uuid.UUID(msg_id)

        with transaction.atomic():
            session = GameSession.objects.select_for_update().get(
                id=session_id,
                user_id=user_id
            )

            if session.status != GameSession.STATUS_ACTIVE:
                return self._state_response(session)

            if session.last_client_msg_id == msg_uuid:
                return {"type": "duplicate"}

            roll = Decimal(str(random.random()))

            safe_prob = max(
                Decimal("0.10"),
                BASE_SAFE_PROB - Decimal(session.step_index) * Decimal("0.05")
            )

            if roll < safe_prob:
                tile = "safe"
                session.current_multiplier += Decimal(random.choice(["0.15", "0.25", "0.40"]))
            elif roll < Decimal("0.70"):
                tile = "penalty"
                session.current_multiplier *= Decimal("0.5")
            elif roll < Decimal("0.85"):
                tile = "reset"
                session.current_multiplier = MIN_MULTIPLIER
            else:
                tile = "trap"
                session.status = GameSession.STATUS_LOST
                session.finished_at = timezone.now()

            session.current_multiplier = max(session.current_multiplier, MIN_MULTIPLIER)
            session.step_index += 1
            session.last_client_msg_id = msg_uuid
            session.save()

            GameRound.objects.create(
                session=session,
                step=session.step_index,
                client_action=action,
                client_choice=choice,
                safe_prob=safe_prob,
                result=tile,
                multiplier_after=session.current_multiplier,
            )

            return {
                "type": "step_result",
                "result": tile,
                "step_index": session.step_index,
                "current_multiplier": str(session.current_multiplier),
                "status": session.status,
            }

    @database_sync_to_async
    def _process_cashout(self, msg_id, user_id, session_id):
        msg_uuid = uuid.UUID(msg_id)

        with transaction.atomic():
            session = GameSession.objects.select_for_update().get(
                id=session_id,
                user_id=user_id
            )

            if session.status != GameSession.STATUS_ACTIVE:
                return self._state_response(session)

            payout = (session.bet_amount * session.current_multiplier).quantize(Decimal("0.01"))

            session.status = GameSession.STATUS_CASHED
            session.payout_amount = payout
            session.finished_at = timezone.now()
            session.last_client_msg_id = msg_uuid
            session.save()

            GameOutcome.objects.create(
                session=session,
                house_edge=Decimal("0.75"),   # or your real value
                rtp_used=Decimal("0.25"),     # must be provided
                win=True,
                gross_payout=payout,
                net_profit=payout - session.bet_amount,
                reason="cashout",
            )

            credit_payout(
                user_id=session.user_id,
                payout=payout,
                ref=f"fortune:{session.id}:cashout"
            )

            return {
                "type": "cashout_result",
                "payout_amount": str(payout),
                "current_multiplier": str(session.current_multiplier),
                "step_index": session.step_index,
            }

    # ======================================================
    # HELPERS
    # ======================================================
    def _state_response(self, session):
        return {
            "type": "state",
            "status": session.status,
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
            "payout_amount": str(session.payout_amount),
        }

    async def disconnect(self, close_code):
        self.authenticated = False
        self.user_id = None
        self.session_id = None
