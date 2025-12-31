# fortune/consumers.py
from __future__ import annotations
import uuid
import random
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async

from .models import GameSession, GameRound, GameOutcome, PlayerStats, RTPConfig
from .views import verify_ws_token
from .wallet import credit_payout

MIN_MULTIPLIER = Decimal("0.45")

class FortuneConsumer(AsyncJsonWebsocketConsumer):

    async def connect(self):
        await self.accept()
        self.user_id = None
        self.session_id = None

    async def receive_json(self, content, **kwargs):
        t = content.get("type")
        if t == "join":
            await self._join(content)
        elif t == "step":
            await self._step(content)
        elif t == "cashout":
            await self._cashout(content)
        else:
            await self.send_json({"type": "error", "code": "bad_type"})

    async def _join(self, content):
        token = content.get("ws_token")
        try:
            user_id, session_id, nonce = await sync_to_async(verify_ws_token)(token, 120)
        except Exception:
            await self.send_json({"type": "error", "code": "auth_failed"})
            return

        ok = await self._bind(user_id, session_id, nonce)
        if not ok:
            await self.send_json({"type": "error", "code": "invalid_session"})
            return

        s = await self._get_session()
        await self.send_json({
            "type": "joined",
            "status": s.status,
            "step_index": s.step_index,
            "current_multiplier": str(s.current_multiplier),
        })

    @sync_to_async
    def _bind(self, user_id, session_id, nonce):
        try:
            s = GameSession.objects.get(id=session_id, user_id=user_id)
        except GameSession.DoesNotExist:
            return False
        if str(s.server_nonce) != str(nonce):
            return False
        self.user_id = user_id
        self.session_id = session_id
        return True

    @sync_to_async
    def _get_session(self):
        return GameSession.objects.get(id=self.session_id, user_id=self.user_id)

    async def _step(self, content):
        msg_id = content.get("msg_id")
        action = content.get("action")
        choice = content.get("choice")

        if not self.user_id or not self.session_id:
            await self.send_json({"type": "error", "code": "not_joined"})
            return

        res = await self._step_atomic(msg_id, action, choice)
        await self.send_json(res)

    @sync_to_async
    def _step_atomic(self, msg_id, action, choice):
        try:
            msg_uuid = uuid.UUID(msg_id)
        except Exception:
            return {"type": "error", "code": "bad_msg_id"}

        with transaction.atomic():
            s = GameSession.objects.select_for_update().get(
                id=self.session_id,
                user_id=self.user_id
            )

            if s.status != GameSession.STATUS_ACTIVE:
                return {
                    "type": "state",
                    "status": s.status,
                    "step_index": s.step_index,
                    "current_multiplier": str(s.current_multiplier),
                }

            if s.last_client_msg_id == msg_uuid:
                return {"type": "dup"}

            # ---- TILE DECISION (SERVER AUTHORITATIVE) ----
            roll = random.random()

            if roll < 0.55:
                tile_kind = "SAFE"
                delta = Decimal(random.choice(["0.15", "0.25", "0.40"]))
                s.current_multiplier += delta

            elif roll < 0.70:
                tile_kind = "PENALTY"
                s.current_multiplier *= Decimal("0.5")

            elif roll < 0.85:
                tile_kind = "RESET"
                s.current_multiplier = MIN_MULTIPLIER

            else:
                tile_kind = "BOMB"
                s.status = GameSession.STATUS_LOST
                s.finished_at = timezone.now()
                s.last_client_msg_id = msg_uuid
                s.save()
                return {
                    "type": "step_result",
                    "tile_kind": "BOMB",
                    "status": "lost",
                    "step_index": s.step_index,
                    "current_multiplier": str(s.current_multiplier),
                    "revealed_server_seed": s.server_seed,
                }

            if s.current_multiplier < MIN_MULTIPLIER:
                s.current_multiplier = MIN_MULTIPLIER

            s.step_index += 1
            s.last_client_msg_id = msg_uuid
            s.save()

            GameRound.objects.create(
                session=s,
                step=s.step_index,
                client_action=action,
                client_choice=choice,
                result=tile_kind,
                multiplier_after=s.current_multiplier,
            )

            return {
                "type": "step_result",
                "tile_kind": tile_kind,
                "step_index": s.step_index,
                "current_multiplier": str(s.current_multiplier),
            }

    async def _cashout(self, content):
        msg_id = content.get("msg_id")

        if not self.user_id or not self.session_id:
            await self.send_json({"type": "error", "code": "not_joined"})
            return

        res = await self._cashout_atomic(msg_id)
        await self.send_json(res)

    @sync_to_async
    def _cashout_atomic(self, msg_id):
        try:
            uuid.UUID(msg_id)
        except Exception:
            return {"type": "error", "code": "bad_msg_id"}

        with transaction.atomic():
            s = GameSession.objects.select_for_update().get(
                id=self.session_id,
                user_id=self.user_id
            )

            if s.status != GameSession.STATUS_ACTIVE:
                return {
                    "type": "state",
                    "status": s.status,
                    "payout_amount": str(s.payout_amount),
                }

            payout = (s.bet_amount * s.current_multiplier).quantize(Decimal("0.01"))
            s.status = GameSession.STATUS_CASHED
            s.payout_amount = payout
            s.finished_at = timezone.now()
            s.save()

            credit_payout(
                user_id=s.user_id,
                payout=payout,
                ref=f"fortune:{s.id}:cashout"
            )

            return {
                "type": "cashout_result",
                "payout_amount": str(payout),
                "current_multiplier": str(s.current_multiplier),
                "step_index": s.step_index,
                "revealed_server_seed": s.server_seed,
            }
