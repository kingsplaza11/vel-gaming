from django.db import models
from django.conf import settings

class ColorSwitchGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    sequence_length = models.IntegerField(default=5)
    current_sequence = models.JSONField(default=list)
    player_sequence = models.JSONField(default=list)
    multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, default='showing')  # showing, playing, won, lost
    created_at = models.DateTimeField(auto_now_add=True)

class ColorSwitchStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    longest_sequence = models.IntegerField(default=0)