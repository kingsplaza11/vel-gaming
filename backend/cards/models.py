from django.db import models
from django.conf import settings

class CardGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    grid_size = models.IntegerField()
    cards = models.JSONField()
    revealed_cards = models.JSONField(default=list)

    matches_found = models.IntegerField(default=0)
    attempts = models.IntegerField(default=0)  # ✅ NEW
    multiplier = models.DecimalField(default=1, max_digits=6, decimal_places=2)

    status = models.CharField(
        max_length=20,
        default='playing',
        choices=[('playing','playing'),('failed','failed'),('completed','completed')]
    )

    win_amount = models.DecimalField(default=0, max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)


class CardStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    fastest_time = models.IntegerField(default=0)  # in seconds