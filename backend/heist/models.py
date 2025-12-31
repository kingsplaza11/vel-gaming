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
    win_ratio = models.FloatField(default=0.0)  # Add this field - win as percentage of bet
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['win_ratio']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.target_bank} - ₦{self.win_amount} ({self.win_ratio*100:.1f}%)"


class HeistStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_heists = models.IntegerField(default=0)
    successful_heists = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    highest_heist = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    highest_win_ratio = models.FloatField(default=0.0)  # Add this field
    favorite_bank = models.CharField(max_length=50, default='Quantum Bank')
    total_hacks_attempted = models.IntegerField(default=0)
    
    # Track different success tiers
    small_heists = models.IntegerField(default=0)  # 10-30%
    medium_heists = models.IntegerField(default=0)  # 31-40%
    large_heists = models.IntegerField(default=0)   # 41-100%
    epic_heists = models.IntegerField(default=0)    # 101-200%
    legendary_heists = models.IntegerField(default=0) # 201-300%
    
    def __str__(self):
        return f"{self.user.username}'s Heist Stats"
    
    def calculate_success_rate(self):
        """Calculate success rate as percentage"""
        if self.total_heists == 0:
            return 0
        return (self.successful_heists / self.total_heists * 100)