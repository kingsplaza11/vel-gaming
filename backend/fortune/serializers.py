# fortune/serializers.py
from __future__ import annotations
from decimal import Decimal
from rest_framework import serializers
from .models import GameSession, GameRound, RTPConfig


class StartSessionIn(serializers.Serializer):
    game = serializers.ChoiceField(
        choices=[c[0] for c in RTPConfig.GAME_CHOICES]
    )
    bet_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    client_seed = serializers.CharField(max_length=128)


class StartSessionOut(serializers.Serializer):
    session_id = serializers.UUIDField()
    game = serializers.CharField()
    bet_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    ws_token = serializers.CharField()
    server_seed_hash = serializers.CharField()
    max_steps = serializers.IntegerField()
    max_multiplier = serializers.DecimalField(max_digits=10, decimal_places=4)


class SessionStateOut(serializers.Serializer):
    session_id = serializers.UUIDField()
    status = serializers.CharField()
    step_index = serializers.IntegerField()
    current_multiplier = serializers.DecimalField(max_digits=18, decimal_places=8)
    payout_amount = serializers.DecimalField(max_digits=14, decimal_places=2)


class CashoutOut(serializers.Serializer):
    session_id = serializers.UUIDField()
    status = serializers.CharField()
    payout_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    revealed_server_seed = serializers.CharField()
