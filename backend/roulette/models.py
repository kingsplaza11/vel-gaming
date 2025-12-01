from django.db import models
from django.conf import settings

class RouletteGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    bet_type = models.CharField(max_length=50)  # 'number', 'color', 'even_odd', etc.
    bet_value = models.CharField(max_length=50)  # e.g., 'red', 'black', '5', 'even'
    result = models.IntegerField()  # the number that came up
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class RouletteStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)