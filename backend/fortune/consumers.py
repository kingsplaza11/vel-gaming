# fortune/consumers.py
from __future__ import annotations

import uuid
import random
import time
import traceback
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.db import connection, DatabaseError
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async

from .models import GameSession, GameRound, GameOutcome
from .views import verify_ws_token
from .wallet import credit_payout


# ===============================
# GAME CONSTANTS
# ===============================

MIN_MULTIPLIER = Decimal("0.45")
BASE_SAFE_PROB = Decimal("0.55")

SESSION_RETRY_ATTEMPTS = 6
SESSION_RETRY_DELAY = 0.15  # seconds


# ===============================
# CONSUMER
# ===============================

class FortuneConsumer(AsyncJsonWebsocketConsumer):

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
            "message": "Fortune Mouse socket ready"
        })

    async def disconnect(self, close_code):
        self.authenticated = False
        self.user_id = None
        self.session_id = None

    # ===============================
    # ROUTER
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
                await self.send_error("invalid_message_type", "Unknown message")

        except Exception as e:
            traceback.print_exc()
            await self.send_error("server_error", "Unhandled server error")
            await self.close(code=1011)

    # ===============================
    # JOIN / AUTH
    # ===============================

    async def handle_join(self, content):
        token = content.get("ws_token")

        if not token:
            await self.send_error("missing_token", "Token required")
            await self.close(code=4001)
            return

        try:
            user_id, session_id, nonce = await database_sync_to_async(
                verify_ws_token
            )(token, 120)
            print(f"[FortuneWS] Token verified: user={user_id}, session={session_id}")
        except Exception as e:
            print(f"[FortuneWS] Token verification failed: {e}")
            await self.send_error("auth_failed", "Invalid token")
            await self.close(code=4001)
            return

        # Get the session with retry
        session = await self.get_session_with_retry(user_id, session_id)
        
        if not session:
            print(f"[FortuneWS] Session not found: user={user_id}, session={session_id}")
            await self.send_error("session_not_found", "Session not found or expired")
            await self.close(code=4002)
            return

        # Verify nonce
        if str(session.server_nonce) != str(nonce):
            print(f"[FortuneWS] Nonce mismatch: expected={session.server_nonce}, got={nonce}")
            await self.send_error("auth_failed", "Session token mismatch")
            await self.close(code=4001)
            return

        # Check session status
        if session.status != GameSession.STATUS_ACTIVE:
            print(f"[FortuneWS] Session not active: status={session.status}")
            await self.send_error("session_inactive", "Session is no longer active")
            await self.close(code=4003)
            return

        self.user_id = user_id
        self.session_id = session_id
        self.authenticated = True

        print(f"[FortuneWS] User {user_id} joined session {session_id}")

        await self.send_json({
            "type": "joined",
            "session_id": str(session.id),
            "game": session.game,
            "status": session.status,
            "step_index": session.step_index,
            "current_multiplier": str(session.current_multiplier),
            "payout_amount": str(session.payout_amount),
        })

    @database_sync_to_async
    def get_session_with_retry(self, user_id, session_id):
        """
        Postgres-safe visibility retry with exponential backoff.
        """
        for attempt in range(SESSION_RETRY_ATTEMPTS):
            try:
                # Ensure fresh database connection
                connection.close_if_unusable_or_obsolete()
                
                session = GameSession.objects.get(
                    id=session_id,
                    user_id=user_id
                )
                print(f"[FortuneWS] Session found on attempt {attempt + 1}: {session.id}")
                return session
            except GameSession.DoesNotExist:
                if attempt < SESSION_RETRY_ATTEMPTS - 1:
                    # Exponential backoff
                    delay = SESSION_RETRY_DELAY * (2 ** attempt)
                    time.sleep(min(delay, 1.0))  # Cap at 1 second
                print(f"[FortuneWS] Session not found, attempt {attempt + 1}")
                continue
            except DatabaseError:
                connection.close_if_unusable_or_obsolete()
                time.sleep(SESSION_RETRY_DELAY)
        
        print(f"[FortuneWS] All retry attempts failed for session {session_id}")
        return None

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
        except Exception:
            traceback.print_exc()
            await self.send_error("server_error", "Step failed")
            await self.close(code=1011)

    @database_sync_to_async
    def process_step(self, msg_id, action, choice):
        msg_uuid = uuid.UUID(msg_id)

        with transaction.atomic():
            session = GameSession.objects.select_for_update().get(
                id=self.session_id,
                user_id=self.user_id
            )

            if session.status != GameSession.STATUS_ACTIVE:
                return self.session_state(session)

            if session.last_client_msg_id == msg_uuid:
                return {"type": "duplicate"}

            roll = random.random()

            safe_prob = max(
                Decimal("0.10"),
                BASE_SAFE_PROB - Decimal(session.step_index) * Decimal("0.05")
            )

            tile = "safe"

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

            session.current_multiplier = max(
                session.current_multiplier,
                MIN_MULTIPLIER
            )

            session.step_index += 1
            session.last_client_msg_id = msg_uuid

            if tile == "trap":
                session.finished_at = timezone.now()

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
        except Exception:
            traceback.print_exc()
            await self.send_error("server_error", "Cashout failed")
            await self.close(code=1011)

    @database_sync_to_async
    def process_cashout(self, msg_id):
        msg_uuid = uuid.UUID(msg_id)

        with transaction.atomic():
            session = GameSession.objects.select_for_update().get(
                id=self.session_id,
                user_id=self.user_id
            )

            if session.status != GameSession.STATUS_ACTIVE:
                return self.session_state(session)

            payout = (
                session.bet_amount * session.current_multiplier
            ).quantize(Decimal("0.01"))

            session.status = GameSession.STATUS_CASHED
            session.payout_amount = payout
            session.finished_at = timezone.now()
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

        # Credit wallet OUTSIDE transaction
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