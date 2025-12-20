from django.db import models
from django.conf import settings

class TreasureHunt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    map_level = models.IntegerField(default=1)  # 1-5, higher levels = better treasures
    treasures_found = models.JSONField()  # List of treasures found
    total_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class TreasureStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_hunts = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    highest_level_completed = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username}'s Treasure Stats"