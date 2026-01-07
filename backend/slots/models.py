# models.py
from django.db import models
from django.conf import settings

class SlotGame(models.Model):
    THEME_CHOICES = [
        ('classic', 'Classic'),
        ('fruit', 'Fruit'),
        ('diamond', 'Diamond'),
        ('ancient', 'Ancient'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='slot_games')
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='classic')
    bet_amount = models.DecimalField(max_digits=10, decimal_places=2)
    result = models.JSONField()  # Store reels, win info, winning lines
    win_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # Added multiplier field
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
        ]

class SlotStats(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='slot_stats'
    )
    total_spins = models.IntegerField(default=0)
    total_won = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_bet = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    winning_spins = models.IntegerField(default=0)  # Added winning_spins field
    highest_multiplier = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # Added highest_multiplier field
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s Slot Stats"
    
    @property
    def profit_loss(self):
        return self.total_won - self.total_bet
    
    class Meta:
        verbose_name_plural = "Slot Statistics"