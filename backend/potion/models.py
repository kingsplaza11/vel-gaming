from django.db import models
from django.conf import settings

class PotionBrew(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    ingredients_used = models.JSONField()
    potion_result = models.JSONField()
    success_level = models.CharField(max_length=20)  # perfect, good, failed
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class PotionStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_brews = models.IntegerField(default=0)
    perfect_brews = models.IntegerField(default=0)
    good_brews = models.IntegerField(default=0)
    failed_brews = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    legendary_ingredients_used = models.IntegerField(default=0)
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    preferred_ingredient_matches = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username}'s Potion Stats"