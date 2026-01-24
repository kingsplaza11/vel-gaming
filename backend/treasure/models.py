from django.db import models
from django.conf import settings

class TreasureHunt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    map_level = models.IntegerField(default=1)  # 1-5, higher levels = better treasures
    treasures_found = models.JSONField()  # List of treasures found
    total_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    win_ratio = models.FloatField(default=0.0)  # Add this field - win amount as percentage of bet
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['win_ratio']),
        ]

    def __str__(self):
        return f"{self.user.username} - Lv{self.map_level} - ₦{self.win_amount} ({self.win_ratio*100:.1f}%)"


class TreasureStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_hunts = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    highest_win_ratio = models.FloatField(default=0.0)  # Add this field
    highest_level_completed = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username}'s Treasure Stats"
    
    def calculate_success_rate(self):
        """Calculate win rate as percentage"""
        if self.total_hunts == 0:
            return 0
        return (self.total_won / self.total_bet * 100) if self.total_bet > 0 else 0