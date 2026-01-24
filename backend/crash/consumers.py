import json
from decimal import Decimal
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from django.db import transaction
from django.conf import settings

from .models import GameRound, CrashBet, RiskSettings
from wallets.services import place_bet_atomic, cashout_atomic
from wallets.models import Wallet

class CrashConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_anonymous:
            await self.close()
            return

        self.mode = self.scope["url_route"]["kwargs"]["mode"]
        self.is_demo = self.mode == "demo"
        self.group_name = f"crash_{self.mode}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send_json({
            "event": "connected",
            "mode": self.mode,
        })

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        event = content.get("event")
        data = content.get("data") or {}

        if event == "place_bet":
            await self.handle_place_bet(data)
        elif event == "cashout":
            await self.handle_cashout(data)

    @database_sync_to_async
    def _get_current_round(self):
        return GameRound.objects.filter(is_demo=self.is_demo).order_by("-id").first()

    @database_sync_to_async
    def _place_bet(self, user, amount, auto_cashout, ip, device_fp):
        round_obj = self._get_current_round_sync()
        # we must lock in DB for status
        risk = RiskSettings.get()
        if amount > risk.max_bet_per_player:
            raise ValueError("Max bet exceeded")

        if round_obj.status != "PENDING":
            raise ValueError("Betting closed")

        # enforce exposure
        total_exposure = (
            CrashBet.objects.filter(round=round_obj).aggregate_sum("bet_amount")  # pseudo
        )
        if total_exposure and total_exposure + amount > risk.max_exposure_per_round:
            raise ValueError("Max exposure reached")

        # atomic wallet deduction
        ref = f"CRASHBET-{round_obj.id}-{user.id}-{int(timezone.now().timestamp())}"
        place_bet_atomic(user, amount, ref, is_demo=self.is_demo)

        bet = CrashBet.objects.create(
            user=user,
            round=round_obj,
            bet_amount=amount,
            auto_cashout=auto_cashout,
            status="ACTIVE",
            is_demo=self.is_demo,
            ip_address=ip,
            device_fingerprint=device_fp,
        )
        return round_obj, bet

    def _get_current_round_sync(self):
        return GameRound.objects.filter(is_demo=self.is_demo).order_by("-id").first()

    @database_sync_to_async
    def _cashout(self, user, bet_id, current_multiplier):
        bet = (
            CrashBet.objects.select_for_update()
            .select_related("round", "user")
            .get(id=bet_id, user=user, is_demo=self.is_demo)
        )
        if bet.status != "ACTIVE":
            raise ValueError("Bet not active")

        round_obj = bet.round
        if round_obj.status != "RUNNING":
            raise ValueError("Round not running")

        # prevent cashout after crash
        if current_multiplier > round_obj.crash_point:
            raise ValueError("Too late to cashout")

        payout = (bet.bet_amount * Decimal(str(current_multiplier))).quantize(Decimal("0.01"))
        ref = f"CRASHCASHOUT-{bet.id}-{int(timezone.now().timestamp())}"

        bet.cashout_multiplier = Decimal(str(current_multiplier))
        cashout_atomic(user, bet, payout, ref, is_demo=self.is_demo)

        return bet, payout, round_obj

    async def handle_place_bet(self, data):
        user = self.scope["user"]
        amount = Decimal(str(data.get("amount", "0")))
        auto_cashout = data.get("auto_cashout")
        auto_cashout = Decimal(str(auto_cashout)) if auto_cashout else None

        ip = self.scope.get("client")[0]
        device_fp = data.get("device_fp")

        try:
            round_obj, bet = await self._place_bet(user, amount, auto_cashout, ip, device_fp)
        except Exception as e:
            await self.send_json({"event": "error", "message": str(e)})
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "player.bet",
                "data": {
                    "user": user.username,
                    "bet_id": bet.id,
                    "amount": str(amount),
                    "auto_cashout": str(auto_cashout) if auto_cashout else None,
                },
            },
        )

        await self.send_json(
            {"event": "bet_accepted", "round_id": round_obj.id, "bet_id": bet.id}
        )

    async def handle_cashout(self, data):
        user = self.scope["user"]
        bet_id = data.get("bet_id")
        current_multiplier = Decimal(str(data.get("multiplier")))
        try:
            bet, payout, round_obj = await self._cashout(user, bet_id, current_multiplier)
        except Exception as e:
            await self.send_json({"event": "error", "message": str(e)})
            return

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "player.cashout",
                "data": {
                    "user": user.username,
                    "bet_id": bet.id,
                    "payout": str(payout),
                    "multiplier": str(bet.cashout_multiplier),
                },
            },
        )

        await self.send_json(
            {
                "event": "cashout_success",
                "bet_id": bet.id,
                "payout": str(payout),
                "multiplier": str(bet.cashout_multiplier),
            }
        )

    # group handlers from engine
    async def round_start(self, event):
        await self.send_json({"event": "round_start", "data": event["data"]})

    async def round_countdown(self, event):
        await self.send_json({"event": "round_countdown", "data": event["data"]})

    async def round_lock_bets(self, event):
        await self.send_json({"event": "round_lock_bets", "data": event["data"]})

    async def round_multiplier(self, event):
        await self.send_json({"event": "multiplier_update", "data": event["data"]})

    async def round_crash(self, event):
        await self.send_json({"event": "round_crash", "data": event["data"]})

    async def player_bet(self, event):
        await self.send_json({"event": "player_bet", "data": event["data"]})

    async def player_cashout(self, event):
        await self.send_json({"event": "player_cashout", "data": event["data"]})
