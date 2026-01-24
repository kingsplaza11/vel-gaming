from django.db import models
from django.conf import settings

class PotionBrew(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    ingredients_used = models.JSONField()
    potion_result = models.JSONField()
    success_level = models.CharField(max_length=20)  # divine, legendary, masterpiece, perfect, good, failed
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    win_ratio = models.FloatField(default=0.0)  # Add this field
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['win_ratio']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.success_level} - ₦{self.win_amount}"


class PotionStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_brews = models.IntegerField(default=0)
    divine_brews = models.IntegerField(default=0)
    legendary_brews = models.IntegerField(default=0)
    masterpiece_brews = models.IntegerField(default=0)
    perfect_brews = models.IntegerField(default=0)
    good_brews = models.IntegerField(default=0)
    failed_brews = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    legendary_ingredients_used = models.IntegerField(default=0)
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    highest_win_ratio = models.FloatField(default=0.0)  # Add this field
    preferred_ingredient_matches = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username}'s Potion Stats"