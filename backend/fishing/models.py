from django.db import models
from django.conf import settings


class FishingSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    catch_result = models.JSONField()
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.catch_result.get('name', 'No Catch')} ({self.win_amount})"


class FishingStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_sessions = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    biggest_catch = models.CharField(max_length=50, default='')

    def __str__(self):
        return f"{self.user} Fishing Stats"
