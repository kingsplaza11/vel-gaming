from django.db import models
from django.conf import settings

class BlackjackGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    player_hand = models.JSONField()  # List of cards
    dealer_hand = models.JSONField()  # List of cards
    result = models.CharField(max_length=20)  # 'win', 'lose', 'push'
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class BlackjackStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    wins = models.IntegerField(default=0)
    losses = models.IntegerField(default=0)
    pushes = models.IntegerField(default=0)