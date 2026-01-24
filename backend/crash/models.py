from django.conf import settings
from django.db import models

class GameRound(models.Model):
    ROUND_STATUS = [
        ("PENDING", "Pending Bets"),
        ("RUNNING", "Running"),
        ("CRASHED", "Crashed"),
        ("SETTLED", "Settled"),
    ]

    server_seed = models.CharField(max_length=128)
    server_seed_hash = models.CharField(max_length=64)  # sha256(server_seed)
    client_seed = models.CharField(max_length=64)
    nonce = models.PositiveBigIntegerField()
    crash_point = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.CharField(max_length=16, choices=ROUND_STATUS, default="PENDING")
    started_at = models.DateTimeField(null=True, blank=True)
    crashed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    is_demo = models.BooleanField(default=False)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"Round {self.id} @ {self.crash_point}x"


class CrashBet(models.Model):
    BET_STATUS = [
        ("PENDING", "Pending"),
        ("ACTIVE", "Active"),
        ("CASHED_OUT", "Cashed Out"),
        ("LOST", "Lost"),
        ("CANCELLED", "Cancelled"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    round = models.ForeignKey(GameRound, on_delete=models.CASCADE, related_name="bets")
    bet_amount = models.DecimalField(max_digits=18, decimal_places=2)
    auto_cashout = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    cashed_out_at = models.DateTimeField(null=True, blank=True)
    cashout_multiplier = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    win_amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=BET_STATUS, default="PENDING")

    is_demo = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_fingerprint = models.CharField(max_length=256, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "round", "is_demo")]
        indexes = [
            models.Index(fields=["round", "status"]),
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"Bet {self.id} on Round {self.round_id}"


# In your models.py, update the RiskSettings class:

class RiskSettings(models.Model):
    # Betting limits
    min_bet_per_player = models.DecimalField(
        max_digits=18, decimal_places=2, 
        default=100,  # Minimum ₦100 bet
        verbose_name="Minimum bet per player"
    )
    max_bet_per_player = models.DecimalField(
        max_digits=18, decimal_places=2, 
        default=1000,
        verbose_name="Maximum bet per player"
    )
    max_bet_per_player_per_round = models.DecimalField(
        max_digits=18, decimal_places=2, 
        default=5000,
        verbose_name="Maximum bet per player per round"
    )
    max_exposure_per_round = models.DecimalField(
        max_digits=18, decimal_places=2, 
        default=10000,
        verbose_name="Maximum exposure per round"
    )
    max_win_per_bet = models.DecimalField(
        max_digits=18, decimal_places=2, 
        default=50000,
        verbose_name="Maximum win per bet"
    )
    max_multiplier_cap = models.DecimalField(
        max_digits=8, decimal_places=2, 
        default=500,
        verbose_name="Maximum multiplier cap"
    )
    
    # House edge and game settings
    house_edge_percent = models.DecimalField(
        max_digits=5, decimal_places=2, 
        default=1.00,
        verbose_name="House edge percentage"
    )
    min_auto_cashout = models.DecimalField(
        max_digits=8, decimal_places=2, 
        default=1.1,
        verbose_name="Minimum auto cashout multiplier"
    )
    max_auto_cashout = models.DecimalField(
        max_digits=8, decimal_places=2, 
        default=100.0,
        verbose_name="Maximum auto cashout multiplier"
    )
    
    # Game control
    allow_demo = models.BooleanField(default=True)
    allow_real_money = models.BooleanField(default=True)
    
    # Cooldown settings
    bet_cooldown_seconds = models.IntegerField(
        default=1,
        verbose_name="Bet cooldown in seconds"
    )
    
    # Anti-bot settings
    max_bets_per_minute = models.IntegerField(
        default=30,
        verbose_name="Maximum bets per minute"
    )
    
    # Audit fields
    last_modified = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Risk Settings"
        verbose_name_plural = "Risk Settings"

    def __str__(self):
        return "Crash Game Risk Settings"

    @staticmethod
    def get():
        obj, created = RiskSettings.objects.get_or_create(
            pk=1,
            defaults={
                'min_bet_per_player': 100,
                'max_bet_per_player': 1000,
                'max_bet_per_player_per_round': 5000,
                'max_exposure_per_round': 10000,
                'max_win_per_bet': 50000,
                'max_multiplier_cap': 500,
                'house_edge_percent': 1.00,
                'min_auto_cashout': 1.1,
                'max_auto_cashout': 100.0,
                'bet_cooldown_seconds': 1,
                'max_bets_per_minute': 30,
            }
        )
        return obj


class AuditLog(models.Model):
    ACTION_TYPES = [
        ("BET_PLACED", "Bet placed"),
        ("CASHOUT", "Cashout"),
        ("ADMIN_ADJUST", "Admin wallet adjust"),
        ("BAN", "Player banned"),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=32, choices=ACTION_TYPES)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["action", "created_at"])]
