from django.db import models
from django.conf import settings

class LightningVaultSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    stake = models.DecimalField(max_digits=12, decimal_places=2)
    multiplier = models.DecimalField(max_digits=10, decimal_places=4, default=1.0)
    ticks = models.IntegerField(default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
