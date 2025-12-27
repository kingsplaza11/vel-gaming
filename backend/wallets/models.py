from django.conf import settings
from django.db import models

class Wallet(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    locked_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    spot_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet({self.user_id})"



class WalletTransaction(models.Model):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"
    TX_TYPE_CHOICES = [
        (DEBIT, "Debit"),
        (CREDIT, "Credit"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet_txs"
    )
    meta = models.JSONField(default=dict)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    tx_type = models.CharField(max_length=6, choices=TX_TYPE_CHOICES)
    reference = models.CharField(max_length=64, unique=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.tx_type} {self.amount} for {self.user_id}"
