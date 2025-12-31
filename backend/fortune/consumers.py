from __future__ import annotations

import uuid
import random
import traceback
from decimal import Decimal

from django.utils import timezone
from django.db import IntegrityError
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from .models import GameSession, GameRound, GameOutcome
from .views import verify_ws_token
from .wallet import credit_payout


MIN_MULTIPLIER = Decimal("0.45")
BASE_SAFE_PROB = Decimal("0.55")


class FortuneConsumer(AsyncJsonWebsocketConsumer):
    """
    SQLite-safe Fortune Mouse WebSocket consumer
    """

    # ===============================
    # CONNECTION
    # ===============================

    async def connect(self):
        await self.accept()

        self.user_id = None
        self.session_id = None
        self.authenticated = False

        await self.send_json({
            "type": "connected",
            "message": "Connected to Fortune Mouse"
        })

    async def disconnect(self, close_code):
        self.authenticated = False
        self.user_id = None
        self.session_id = None

    # ===============================
    # MESSAGE ROUTER
    # ===============================

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
                await self.send_error("invalid_message_type", "Unknown message type")

        except Exception as e:
            traceback.print_exc()
            await self.send_error("server_error", str(e))

    # ===============================
    # JOIN / AUTH
    # ===============================

    async def handle_join(self, content):
        token = content.get("ws_token")
        if not token:
            await self.send_error("missing_token", "No token provided")
            await self.close(code=4001)
            return

        try:
            user_id, session_id, nonce = await database_sync_to_async(verify_ws_token)(token, 120)
        except Exception:
            await self.send_error("auth_failed", "Invalid token")
            await self.close(code=4001)
            return

        ok = await self.bind_session(user_id, session_id, nonce)
        if not ok:
            await self.send_error("session_not_found", "Invalid session")
            await self.close(code=4002)
            return

        session = await self.get_session()
        await self.send_json({
            "type": "joined",
            "session_id": str(session.id),
            "game": "fortune_mouse",
            "status": session.status,
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
            "payout_amount": str(session.payout_amount),
        })

    @database_sync_to_async
    def bind_session(self, user_id, session_id, nonce):
        try:
            session = GameSession.objects.get(id=session_id, user_id=user_id)
            if str(session.server_nonce) != str(nonce):
                return False

            self.user_id = user_id
            self.session_id = session_id
            self.authenticated = True
            return True
        except GameSession.DoesNotExist:
            return False

    @database_sync_to_async
    def get_session(self):
        return GameSession.objects.get(id=self.session_id, user_id=self.user_id)

    # ===============================
    # STEP
    # ===============================

    async def handle_step(self, content):
        if not self.authenticated:
            await self.send_error("not_authenticated", "Join first")
            return

        try:
            result = await self.process_step(
                msg_id=content.get("msg_id"),
                action=content.get("action"),
                choice=content.get("choice"),
            )
            await self.send_json(result)
        except Exception as e:
            traceback.print_exc()
            await self.send_error("server_error", str(e))

    @database_sync_to_async
    def process_step(self, msg_id, action, choice):
        msg_uuid = uuid.UUID(msg_id)

        session = GameSession.objects.get(
            id=self.session_id,
            user_id=self.user_id
        )

        if session.status != GameSession.STATUS_ACTIVE:
            return self.session_state(session)

        if session.last_client_msg_id == msg_uuid:
            return {"type": "duplicate"}

        expected_version = session.version

        roll = random.random()

        safe_prob = max(
            Decimal("0.10"),
            BASE_SAFE_PROB - Decimal(session.step_index) * Decimal("0.05")
        )

        tile = "safe"
        delta = Decimal("0.00")

        if roll < float(safe_prob):
            delta = Decimal(random.choice(["0.15", "0.25", "0.40"]))
            session.current_multiplier += delta
        elif roll < 0.70:
            tile = "penalty"
            session.current_multiplier *= Decimal("0.5")
        elif roll < 0.85:
            tile = "reset"
            session.current_multiplier = MIN_MULTIPLIER
        else:
            tile = "trap"
            session.status = GameSession.STATUS_LOST

        session.current_multiplier = max(session.current_multiplier, MIN_MULTIPLIER)
        session.step_index += 1
        session.version += 1
        session.last_client_msg_id = msg_uuid

        updated = GameSession.objects.filter(
            id=session.id,
            version=expected_version
        ).update(
            step_index=session.step_index,
            current_multiplier=session.current_multiplier,
            status=session.status,
            version=session.version,
            last_client_msg_id=session.last_client_msg_id,
        )

        if updated == 0:
            return {
                "type": "error",
                "code": "state_conflict",
                "message": "Out of sync"
            }

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
            "status": session.status,
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
        }

    # ===============================
    # CASHOUT
    # ===============================

    async def handle_cashout(self, content):
        if not self.authenticated:
            await self.send_error("not_authenticated", "Join first")
            return

        try:
            result = await self.process_cashout(content.get("msg_id"))
            await self.send_json(result)
        except Exception as e:
            traceback.print_exc()
            await self.send_error("server_error", str(e))

    @database_sync_to_async
    def process_cashout(self, msg_id):
        msg_uuid = uuid.UUID(msg_id)

        session = GameSession.objects.get(
            id=self.session_id,
            user_id=self.user_id
        )

        if session.status != GameSession.STATUS_ACTIVE:
            return self.session_state(session)

        payout = (session.bet_amount * session.current_multiplier).quantize(Decimal("0.01"))

        session.status = GameSession.STATUS_CASHED
        session.payout_amount = payout
        session.finished_at = timezone.now()
        session.version += 1
        session.last_client_msg_id = msg_uuid
        session.save()

        GameOutcome.objects.create(
            session=session,
            house_edge=Decimal("0.75"),
            rtp_used=Decimal("0.25"),
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

    # ===============================
    # HELPERS
    # ===============================

    def session_state(self, session):
        return {
            "type": "state",
            "status": session.status,
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
            "payout_amount": str(session.payout_amount),
        }

    async def send_error(self, code, message):
        await self.send_json({
            "type": "error",
            "code": code,
            "message": message
        })
