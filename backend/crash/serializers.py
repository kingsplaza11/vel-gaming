from rest_framework import serializers
from .models import GameRound, CrashBet

class GameRoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = GameRound
        fields = [
            "id",
            "crash_point",
            "server_seed_hash",
            "client_seed",
            "nonce",
            "created_at",
            "is_demo",
        ]


class CrashBetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrashBet
        fields = [
            "id",
            "round",
            "bet_amount",
            "auto_cashout",
            "cashout_multiplier",
            "win_amount",
            "status",
            "created_at",
        ]
