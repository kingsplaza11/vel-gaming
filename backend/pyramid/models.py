from django.db import models
from django.conf import settings

class PyramidExploration(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    chambers_explored = models.JSONField()
    traps_encountered = models.IntegerField(default=0)
    artifacts_found = models.JSONField()
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    win_ratio = models.FloatField(default=0.0)  # Add this field
    survival_rate = models.FloatField(default=0.0)  # Add this field
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['win_ratio']),
        ]

    def __str__(self):
        return f"{self.user.username} - ₦{self.win_amount} ({self.win_ratio*100:.1f}%)"


class PyramidStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_expeditions = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    traps_survived = models.IntegerField(default=0)
    total_artifacts = models.IntegerField(default=0)
    divine_artifacts_found = models.PositiveIntegerField(default=0)  # Add this line
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    highest_win_ratio = models.FloatField(default=0.0)  # Add this field
    highest_survival_rate = models.FloatField(default=0.0)  # Add this field
    chambers_explored_total = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username}'s Pyramid Stats"