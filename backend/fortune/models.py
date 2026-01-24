# fortune/models.py
from __future__ import annotations

import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

User = settings.AUTH_USER_MODEL


class RTPConfig(models.Model):
    GAME_MOUSE = "fortune_mouse"
    GAME_TIGER = "fortune_tiger"
    GAME_RABBIT = "fortune_rabbit"

    GAME_CHOICES = [
        (GAME_MOUSE, "Fortune Mouse"),
        (GAME_TIGER, "Fortune Tiger"),
        (GAME_RABBIT, "Fortune Rabbit"),
    ]

    game = models.CharField(max_length=32, choices=GAME_CHOICES, unique=True)

    # RTP is capped at 0.30 by your rules
    target_rtp = models.DecimalField(
        max_digits=4, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("0.49"))],
        default=Decimal("0.25"),
    )

    # Hard cap: probability to win anything <= 0.30
    win_prob_cap = models.DecimalField(
        max_digits=4, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01")), MaxValueValidator(Decimal("0.48"))],
        default=Decimal("0.28"),
    )

    max_steps = models.PositiveIntegerField(default=25, validators=[MinValueValidator(1), MaxValueValidator(200)])
    max_multiplier = models.DecimalField(
        max_digits=10, decimal_places=4,
        validators=[MinValueValidator(Decimal("1.00")), MaxValueValidator(Decimal("10000.00"))],
        default=Decimal("50.0000"),
    )

    # Trap increases → safe probability decreases per step
    # Step1 safe prob will be min(base_safe_prob, win_prob_cap)
    base_safe_prob = models.DecimalField(
        max_digits=4, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.05")), MaxValueValidator(Decimal("0.99"))],
        default=Decimal("0.40"),
    )
    safe_prob_decay = models.DecimalField(
        max_digits=5, decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001")), MaxValueValidator(Decimal("0.200"))],
        default=Decimal("0.020"),
    )
    min_safe_prob = models.DecimalField(
        max_digits=4, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01")), MaxValueValidator(Decimal("0.50"))],
        default=Decimal("0.05"),
    )

    # Risk controls
    daily_win_cap_per_user = models.DecimalField(
        max_digits=14, decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
        default=Decimal("0.00"),  # 0 means disabled
    )

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.game} (RTP={self.target_rtp}, cap={self.win_prob_cap})"


# fortune/models.py - Update GameSession Meta class
class GameSession(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_LOST = "lost"
    STATUS_CASHED = "cashed_out"
    STATUS_EXPIRED = "expired"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_LOST, "Lost"),
        (STATUS_CASHED, "Cashed Out"),
        (STATUS_EXPIRED, "Expired"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True)
    game = models.CharField(max_length=32, db_index=True)

    bet_amount = models.DecimalField(max_digits=14, decimal_places=2, validators=[MinValueValidator(Decimal("0.01"))])
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    version = models.PositiveIntegerField(default=0)
    # Server-committed ladder state
    step_index = models.PositiveIntegerField(default=0)  # 0 means not started, 1..N steps taken
    survival_prob = models.DecimalField(max_digits=18, decimal_places=12, default=Decimal("1.0"))
    current_multiplier = models.DecimalField(max_digits=18, decimal_places=8, default=Decimal("1.0"))
    payout_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))

    # Replay protection / anti-dup
    last_client_msg_id = models.UUIDField(null=True, blank=True)
    server_nonce = models.UUIDField(default=uuid.uuid4, editable=False)  # binds to this session

    # For provable audit (commit-reveal style without exposing secret)
    server_seed_hash = models.CharField(max_length=128, db_index=True)
    server_seed = models.CharField(max_length=128)  # store encrypted at rest if possible
    client_seed = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "game", "status"]),
            models.Index(fields=["created_at"]),
            models.Index(fields=["id", "user_id"]),  # Add this for WS lookups
            models.Index(fields=["server_nonce"]),   # Add this for token verification
        ]

    def __str__(self) -> str:
        return f"{self.game} {self.id} ({self.status})"


# fortune/models.py - Update GameRound model
class GameRound(models.Model):
    RESULT_SAFE = "safe"
    RESULT_TRAP = "trap"

    id = models.BigAutoField(primary_key=True)
    session = models.ForeignKey(GameSession, on_delete=models.CASCADE, related_name="rounds")
    step = models.PositiveIntegerField()
    client_action = models.CharField(max_length=32, default="")  # Add default
    client_choice = models.CharField(max_length=64, default="")
    safe_prob = models.DecimalField(max_digits=6, decimal_places=4, default=Decimal("0.55"))  # Add default
    result = models.CharField(max_length=8, choices=[(RESULT_SAFE, "Safe"), (RESULT_TRAP, "Trap")], default=RESULT_SAFE)  # Add default

    rng_u = models.DecimalField(max_digits=18, decimal_places=12, default=Decimal("0.0"))  # Add default
    multiplier_after = models.DecimalField(max_digits=18, decimal_places=8, default=Decimal("1.0"))  # Add default
    survival_prob_after = models.DecimalField(max_digits=18, decimal_places=12, default=Decimal("1.0"))  # Add default

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("session", "step")]
        indexes = [
            models.Index(fields=["session", "step"]),
        ]


class GameOutcome(models.Model):
    id = models.BigAutoField(primary_key=True)
    session = models.OneToOneField(GameSession, on_delete=models.CASCADE, related_name="outcome")
    house_edge = models.DecimalField(max_digits=6, decimal_places=4)  # 1 - rtp (if not capped by max multiplier)
    rtp_used = models.DecimalField(max_digits=6, decimal_places=4)
    win = models.BooleanField(default=False)
    gross_payout = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    net_profit = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))  # payout - bet
    reason = models.CharField(max_length=64, default="")  # "cashout", "trap", "expired"
    created_at = models.DateTimeField(auto_now_add=True)


class PlayerStats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="fortune_stats")
    total_bet = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    total_payout = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0.00"))
    total_sessions = models.PositiveIntegerField(default=0)
    total_wins = models.PositiveIntegerField(default=0)
    last_played_at = models.DateTimeField(null=True, blank=True)

    # Anti-abuse signals
    suspicious_score = models.PositiveIntegerField(default=0)
    fastest_step_ms = models.PositiveIntegerField(default=999999)

    updated_at = models.DateTimeField(auto_now=True)

    def record_speed(self, ms: int) -> None:
        if ms < self.fastest_step_ms:
            self.fastest_step_ms = ms
