from django.db import models
from django.conf import settings

class CardGame(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    grid_size = models.IntegerField()
    cards = models.JSONField()
    revealed_cards = models.JSONField(default=list)
    matches_found = models.IntegerField(default=0)
    attempts = models.IntegerField(default=0)
    multiplier = models.DecimalField(default=1, max_digits=6, decimal_places=2)
    win_amount = models.DecimalField(default=0, max_digits=10, decimal_places=2)
    win_ratio = models.FloatField(default=0.0)  # Add this field
    status = models.CharField(
        max_length=20,
        default='playing',
        choices=[('playing','playing'),('failed','failed'),('completed','completed')]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.status} - ₦{self.win_amount}"


class CardStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_games = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_multiplier = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    highest_win_ratio = models.FloatField(default=0.0)  # Add this field
    fastest_time = models.IntegerField(default=0)  # in seconds
    
    def __str__(self):
        return f"{self.user.username}'s Card Stats"
    
    def calculate_success_rate(self):
        from django.db.models import Count
        total = CardGame.objects.filter(user=self.user).count()
        wins = CardGame.objects.filter(user=self.user, status='completed').count()
        return (wins / total * 100) if total else 0