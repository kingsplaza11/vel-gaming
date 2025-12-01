from django.db import models
from django.conf import settings
import string
import random

def generate_game_id():
    # 10-character random alphanumeric ID
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))

class CrashGame(models.Model):
    id = models.CharField(primary_key=True, max_length=15, default=generate_game_id, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    crash_point = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cash_out_point = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('crashed', 'Crashed'),
        ('cashed_out', 'Cashed Out')
    ], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class CrashStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.user.username}'s Crash Stats"
