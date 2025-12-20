from django.db import models
from django.conf import settings

class TowerGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_height = models.IntegerField(default=0)
    target_height = models.IntegerField(default=10)
    multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, default='building')  # building, completed, crashed
    created_at = models.DateTimeField(auto_now_add=True)

class TowerStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_tower = models.IntegerField(default=0)