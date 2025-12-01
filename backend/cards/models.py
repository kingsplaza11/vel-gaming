from django.db import models
from django.conf import settings

class CardGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    grid_size = models.IntegerField(default=16)  # 4x4 grid
    cards = models.JSONField()  # Card values and positions
    revealed_cards = models.JSONField(default=list)
    matches_found = models.IntegerField(default=0)
    multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, default='playing')  # playing, completed
    created_at = models.DateTimeField(auto_now_add=True)

class CardStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    fastest_time = models.IntegerField(default=0)  # in seconds