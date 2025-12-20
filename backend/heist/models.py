from django.db import models
from django.conf import settings

class CyberHeist(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    target_bank = models.CharField(max_length=50)
    security_level = models.IntegerField(default=1)
    hacks_used = models.JSONField()
    escape_success = models.BooleanField(default=False)
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class HeistStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_heists = models.IntegerField(default=0)
    successful_heists = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_heist = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    favorite_bank = models.CharField(max_length=50, default='Quantum Bank')
    total_hacks_attempted = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username}'s Heist Stats"