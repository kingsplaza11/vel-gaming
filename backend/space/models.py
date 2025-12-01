from django.db import models
from django.conf import settings

class SpaceMission(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    mission_type = models.CharField(max_length=50)  # mining, exploration, rescue
    planets_visited = models.JSONField()
    resources_collected = models.JSONField()
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

class SpaceStats(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    total_missions = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    planets_discovered = models.IntegerField(default=0)
    total_resources = models.IntegerField(default=0)
    highest_multiplier = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Mission type counters
    mining_missions = models.IntegerField(default=0)
    exploration_missions = models.IntegerField(default=0)
    rescue_missions = models.IntegerField(default=0)
    
    def __str__(self):
        return f"{self.user.username}'s Space Stats"