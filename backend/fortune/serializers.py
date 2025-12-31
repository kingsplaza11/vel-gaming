# fortune/serializers.py
from __future__ import annotations
from decimal import Decimal
from rest_framework import serializers
from .models import GameSession, RTPConfig


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
    game_title = serializers.CharField()
    game_icon = serializers.CharField()
    grid_size = serializers.IntegerField()
    bet_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    server_seed_hash = serializers.CharField()
    max_steps = serializers.IntegerField()
    max_multiplier = serializers.DecimalField(max_digits=10, decimal_places=4)
    current_multiplier = serializers.DecimalField(max_digits=18, decimal_places=8)
    step_index = serializers.IntegerField()
    min_stake = serializers.DecimalField(max_digits=14, decimal_places=2)
    character = serializers.CharField()
    color = serializers.CharField()


class SessionStateOut(serializers.Serializer):
    session_id = serializers.UUIDField()
    status = serializers.CharField()
    step_index = serializers.IntegerField()
    current_multiplier = serializers.DecimalField(max_digits=18, decimal_places=8)
    payout_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    game = serializers.CharField()


class StepIn(serializers.Serializer):
    tile_id = serializers.IntegerField(min_value=0, max_value=99)
    msg_id = serializers.CharField(required=False)


class StepOut(serializers.Serializer):
    type = serializers.CharField()
    result = serializers.CharField()
    status = serializers.CharField()
    step_index = serializers.IntegerField()
    current_multiplier = serializers.DecimalField(max_digits=18, decimal_places=8)
    session_id = serializers.UUIDField()
    payout_amount = serializers.DecimalField(
        max_digits=14, 
        decimal_places=2, 
        required=False
    )


class CashoutOut(serializers.Serializer):
    session_id = serializers.UUIDField()
    status = serializers.CharField()
    payout_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    revealed_server_seed = serializers.CharField()
    current_multiplier = serializers.DecimalField(max_digits=18, decimal_places=8)
    step_index = serializers.IntegerField()


class GameConfigOut(serializers.Serializer):
    game = serializers.CharField()
    title = serializers.CharField()
    description = serializers.CharField()
    icon = serializers.CharField()
    grid_size = serializers.IntegerField()
    min_stake = serializers.DecimalField(max_digits=14, decimal_places=2)
    risk_level = serializers.CharField()
    color = serializers.CharField()
    character = serializers.CharField()
    max_steps = serializers.IntegerField()
    max_multiplier = serializers.DecimalField(max_digits=10, decimal_places=4)
    target_rtp = serializers.DecimalField(max_digits=4, decimal_places=2)


class RevealSeedOut(serializers.Serializer):
    session_id = serializers.UUIDField()
    server_seed = serializers.CharField()
    client_seed = serializers.CharField()
    server_seed_hash = serializers.CharField()
    final_multiplier = serializers.DecimalField(max_digits=18, decimal_places=8)
    final_payout = serializers.DecimalField(max_digits=14, decimal_places=2)


class ActiveSessionsOut(serializers.Serializer):
    session_id = serializers.UUIDField()
    game = serializers.CharField()
    bet_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    step_index = serializers.IntegerField()
    current_multiplier = serializers.DecimalField(max_digits=18, decimal_places=8)
    created_at = serializers.DateTimeField()