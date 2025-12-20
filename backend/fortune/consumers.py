# fortune/consumers.py
from __future__ import annotations
import random
import uuid
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from asgiref.sync import sync_to_async

from .models import RTPConfig, GameSession, GameRound, GameOutcome, PlayerStats
from .engine import StepConfig, step_result, multiplier_for_survival, q12
from .views import verify_ws_token
from .wallet import credit_payout
from .abuse import hit_rate_limit, tap_speed_check, RateLimit, AbuseError


# ==========================================================
# SELF-HEALING DEFAULTS (prevents RTPConfig.DoesNotExist)
# ==========================================================
DEFAULT_RTP = {
    "fortune_mouse": {
        "target_rtp": Decimal("0.25"),
        "win_prob_cap": Decimal("0.30"),
        "max_steps": 25,
        "max_multiplier": Decimal("50.0000"),
        "base_safe_prob": Decimal("0.40"),
        "safe_prob_decay": Decimal("0.020"),
        "min_safe_prob": Decimal("0.05"),
        "daily_win_cap_per_user": Decimal("0.00"),
    },
    "fortune_tiger": {
        "target_rtp": Decimal("0.26"),
        "win_prob_cap": Decimal("0.28"),
        "max_steps": 20,
        "max_multiplier": Decimal("40.0000"),
        "base_safe_prob": Decimal("0.38"),
        "safe_prob_decay": Decimal("0.025"),
        "min_safe_prob": Decimal("0.05"),
        "daily_win_cap_per_user": Decimal("0.00"),
    },
    "fortune_rabbit": {
        "target_rtp": Decimal("0.27"),
        "win_prob_cap": Decimal("0.30"),
        "max_steps": 30,
        "max_multiplier": Decimal("60.0000"),
        "base_safe_prob": Decimal("0.42"),
        "safe_prob_decay": Decimal("0.018"),
        "min_safe_prob": Decimal("0.06"),
        "daily_win_cap_per_user": Decimal("0.00"),
    },
}


class FortuneConsumer(AsyncJsonWebsocketConsumer):
    """
    Client sends:
      {type:"join", ws_token:"..."}
      {type:"step", msg_id:"uuid", client_ts_ms:123456789, action:"tile_pick|strike|hop", choice:"7"}
      {type:"cashout", msg_id:"uuid", client_ts_ms:..., }
    """

    async def connect(self):
        await self.accept()
        self.user_id = None
        self.session_id = None
        self.nonce = None

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
        token = content.get("ws_token", "")
        try:
            user_id, session_id, nonce = await sync_to_async(verify_ws_token)(token, 120)
        except Exception:
            await self.send_json({"type": "error", "code": "auth_failed"})
            return

        ok = await self._bind_session(user_id, session_id, nonce)
        if not ok:
            await self.send_json({"type": "error", "code": "session_not_found"})
            return

        state = await self._get_state()
        await self.send_json({"type": "joined", **state})

    @sync_to_async
    def _bind_session(self, user_id: int, session_id: str, nonce: str) -> bool:
        try:
            s = GameSession.objects.get(id=session_id, user_id=user_id)
        except GameSession.DoesNotExist:
            return False
        if str(s.server_nonce) != str(nonce):
            return False
        self.user_id = user_id
        self.session_id = session_id
        self.nonce = nonce
        return True

    # ----------------------------------------------------------
    # RTP CONFIG: self-healing getter
    # ----------------------------------------------------------
    def _get_or_create_rtp(self, game: str) -> RTPConfig:
        defaults = DEFAULT_RTP.get(game)
        if not defaults:
            raise ValueError(f"Unknown fortune game '{game}'")
        cfg, _ = RTPConfig.objects.get_or_create(game=game, defaults=defaults)
        return cfg

    @sync_to_async
    def _get_state(self):
        s = GameSession.objects.get(id=self.session_id, user_id=self.user_id)
        cfgm = self._get_or_create_rtp(s.game)
        return {
            "session_id": str(s.id),
            "game": s.game,
            "status": s.status,
            "step_index": s.step_index,
            "current_multiplier": str(s.current_multiplier),
            "payout_amount": str(s.payout_amount),
            "server_seed_hash": s.server_seed_hash,
            "max_steps": int(cfgm.max_steps),
            "max_multiplier": str(cfgm.max_multiplier),
        }

    async def _step(self, content):
        if not self.user_id or not self.session_id:
            await self.send_json({"type": "error", "code": "not_joined"})
            return

        msg_id = content.get("msg_id")
        action = content.get("action", "")
        choice = str(content.get("choice", ""))
        client_ts_ms = int(content.get("client_ts_ms", 0))

        try:
            # Global rate limit per user
            await sync_to_async(hit_rate_limit)(RateLimit(key=f"fortune:{self.user_id}", limit=20, window_sec=5))
            await sync_to_async(tap_speed_check)(self.user_id, self.session_id, client_ts_ms)
        except AbuseError as e:
            await self.send_json({"type": "error", "code": "abuse", "detail": str(e)})
            return

        res = await self._step_atomic(msg_id, action, choice)
        await self.send_json(res)

    @sync_to_async
    def _step_atomic(self, msg_id: str, action: str, choice: str):
        try:
            msg_uuid = uuid.UUID(msg_id)
        except Exception:
            return {"type": "error", "code": "bad_msg_id"}

        with transaction.atomic():
            s = GameSession.objects.select_for_update().get(id=self.session_id, user_id=self.user_id)
            if s.status != GameSession.STATUS_ACTIVE:
                return {
                    "type": "state",
                    "status": s.status,
                    "step_index": s.step_index,
                    "current_multiplier": str(s.current_multiplier),
                    "payout_amount": str(s.payout_amount),
                }

            # Deduplicate
            if s.last_client_msg_id == msg_uuid:
                return {"type": "dup", "ok": True}

            # ✅ self-healing RTP fetch
            cfgm = self._get_or_create_rtp(s.game)

            # Build step config used by engine (this is your LIVE per-session RTP enforcement)
            cfg = StepConfig(
                target_rtp=Decimal(cfgm.target_rtp),
                win_prob_cap=Decimal(cfgm.win_prob_cap),
                max_steps=int(cfgm.max_steps),
                max_multiplier=Decimal(cfgm.max_multiplier),
                base_safe_prob=Decimal(cfgm.base_safe_prob),
                safe_prob_decay=Decimal(cfgm.safe_prob_decay),
                min_safe_prob=Decimal(cfgm.min_safe_prob),
            )

            next_step = s.step_index + 1
            if next_step > cfg.max_steps:
                # Auto cashout at end
                return self._cashout_locked(s, reason="max_steps")

            # Server decides outcome (provable)
            u, p_safe, is_safe = step_result(
                s.server_seed,
                s.client_seed,
                str(s.server_nonce),
                next_step,
                cfg
            )

            if is_safe:
                new_survival = q12(Decimal(s.survival_prob) * Decimal(p_safe))
                new_mult = multiplier_for_survival(new_survival, cfg)

                GameRound.objects.create(
                    session=s,
                    step=next_step,
                    client_action=action,
                    client_choice=choice,
                    safe_prob=p_safe,
                    result=GameRound.RESULT_SAFE,
                    rng_u=u,
                    multiplier_after=new_mult,
                    survival_prob_after=new_survival,
                )

                s.step_index = next_step
                s.survival_prob = new_survival
                s.current_multiplier = new_mult
                s.last_client_msg_id = msg_uuid
                s.save(update_fields=["step_index", "survival_prob", "current_multiplier", "last_client_msg_id"])

                return {
                    "type": "step_result",
                    "result": "safe",
                    "step_index": s.step_index,
                    "safe_prob": str(p_safe),
                    "rng_u": str(u),
                    "current_multiplier": str(s.current_multiplier),
                    "survival_prob": str(s.survival_prob),
                }

            # Trap: lose, no payout
            GameRound.objects.create(
                session=s,
                step=next_step,
                client_action=action,
                client_choice=choice,
                safe_prob=p_safe,
                result=GameRound.RESULT_TRAP,
                rng_u=u,
                multiplier_after=s.current_multiplier,
                survival_prob_after=s.survival_prob,
            )

            s.step_index = next_step
            s.status = GameSession.STATUS_LOST
            s.finished_at = timezone.now()
            s.payout_amount = Decimal("0.00")
            s.last_client_msg_id = msg_uuid
            s.save(update_fields=["step_index", "status", "finished_at", "payout_amount", "last_client_msg_id"])

            GameOutcome.objects.create(
                session=s,
                house_edge=(Decimal("1.00") - cfg.target_rtp),
                rtp_used=cfg.target_rtp,
                win=False,
                gross_payout=Decimal("0.00"),
                net_profit=(Decimal("0.00") - s.bet_amount),
                reason="trap",
            )

            self._update_stats(s, payout=Decimal("0.00"), win=False)

            return {
                "type": "step_result",
                "result": "trap",
                "step_index": s.step_index,
                "safe_prob": str(p_safe),
                "rng_u": str(u),
                "current_multiplier": str(s.current_multiplier),
                "payout_amount": "0.00",
                "revealed_server_seed": s.server_seed,
            }

    def _cashout_locked(self, s: GameSession, reason: str):
        # must be called inside transaction.atomic with s locked
        if s.step_index <= 0:
            payout = Decimal("0.00")
        else:
            payout = (s.bet_amount * s.current_multiplier).quantize(Decimal("0.01"))

        s.payout_amount = payout
        s.status = GameSession.STATUS_CASHED
        s.finished_at = timezone.now()
        s.save(update_fields=["payout_amount", "status", "finished_at"])

        # Credit payout (wallet atomic inside)
        credit_payout(s.user_id, s.currency, payout, ref=f"fortune:{s.id}:cashout")

        # ✅ self-healing RTP fetch
        cfgm = self._get_or_create_rtp(s.game)
        cfg_target = Decimal(cfgm.target_rtp)

        GameOutcome.objects.update_or_create(
            session=s,
            defaults=dict(
                house_edge=(Decimal("1.00") - cfg_target),
                rtp_used=cfg_target,
                win=(payout > 0),
                gross_payout=payout,
                net_profit=(payout - s.bet_amount),
                reason=reason,
            )
        )

        self._update_stats(s, payout=payout, win=(payout > 0))

        return {
            "type": "cashout_result",
            "status": s.status,
            "payout_amount": str(payout),
            "current_multiplier": str(s.current_multiplier),
            "step_index": s.step_index,
            "revealed_server_seed": s.server_seed,
        }

    def _update_stats(self, s: GameSession, payout: Decimal, win: bool):
        ps, _ = PlayerStats.objects.get_or_create(user_id=s.user_id)
        ps.total_sessions += 1
        ps.total_bet += s.bet_amount
        ps.total_payout += payout
        if win:
            ps.total_wins += 1
        ps.last_played_at = timezone.now()
        ps.save()

    async def _cashout(self, content):
        if not self.user_id or not self.session_id:
            await self.send_json({"type": "error", "code": "not_joined"})
            return

        msg_id = content.get("msg_id")
        client_ts_ms = int(content.get("client_ts_ms", 0))

        try:
            await sync_to_async(hit_rate_limit)(RateLimit(key=f"fortune:cashout:{self.user_id}", limit=8, window_sec=5))
            await sync_to_async(tap_speed_check)(self.user_id, self.session_id, client_ts_ms)
        except AbuseError as e:
            await self.send_json({"type": "error", "code": "abuse", "detail": str(e)})
            return

        res = await self._cashout_atomic(msg_id)
        await self.send_json(res)

    @sync_to_async
    def _cashout_atomic(self, msg_id: str):
        try:
            msg_uuid = uuid.UUID(msg_id)
        except Exception:
            return {"type": "error", "code": "bad_msg_id"}

        with transaction.atomic():
            s = GameSession.objects.select_for_update().get(id=self.session_id, user_id=self.user_id)
            if s.status != GameSession.STATUS_ACTIVE:
                return {
                    "type": "state",
                    "status": s.status,
                    "step_index": s.step_index,
                    "current_multiplier": str(s.current_multiplier),
                    "payout_amount": str(s.payout_amount),
                }

            if s.last_client_msg_id == msg_uuid:
                return {"type": "dup", "ok": True}

            s.last_client_msg_id = msg_uuid
            s.save(update_fields=["last_client_msg_id"])
            return self._cashout_locked(s, reason="cashout")
