from django.db import models
from django.conf import settings

class GuessingGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    target_number = models.IntegerField()
    max_number = models.IntegerField(default=100)
    attempts = models.IntegerField(default=0)
    max_attempts = models.IntegerField(default=10)
    multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    win_ratio = models.FloatField(default=0.0)  # Add this field
    status = models.CharField(max_length=20, default='playing')  # playing, won, lost
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.status} - ₦{self.win_amount}"


class GuessingStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    games_won = models.IntegerField(default=0)
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    highest_win_ratio = models.FloatField(default=0.0)  # Add this field
    
    def __str__(self):
        return f"{self.user.username}'s Guessing Stats"
    
    def win_rate(self):
        if self.total_games == 0:
            return 0
        return (self.games_won / self.total_games * 100)