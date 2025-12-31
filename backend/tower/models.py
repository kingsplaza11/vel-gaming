from django.db import models
from django.conf import settings

class TowerGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    current_height = models.IntegerField(default=0)
    target_height = models.IntegerField(default=10)
    multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    win_ratio = models.FloatField(default=0.0)  # Add this field - win as percentage of bet
    status = models.CharField(max_length=20, default='building')  # building, completed, crashed, cashed_out
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.user.username} - ₦{self.bet_amount} - H{self.current_height}"


class TowerStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_tower = models.IntegerField(default=0)
    highest_win_ratio = models.FloatField(default=0.0)  # Add this field
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # Add this field
    
    def __str__(self):
        return f"{self.user.username}'s Tower Stats"