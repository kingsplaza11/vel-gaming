from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=1000.00)
    
    def __str__(self):
        return self.username