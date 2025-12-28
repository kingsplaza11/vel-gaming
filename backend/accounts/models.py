from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL
# accounts/models.py
import string
import random
from django.contrib.auth.models import AbstractUser
from django.db import models

def generate_uid(length=8):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


class User(AbstractUser):
    email = models.EmailField(unique=True, db_index=True)

    user_uid = models.CharField(
        max_length=8,
        unique=True,
        editable=False,
        db_index=True
    )

    full_name = models.CharField(max_length=120, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)

    referral_code = models.CharField(
        max_length=12,
        unique=True,
        blank=True,
        null=True,
        db_index=True
    )

    referred_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="referrals"
    )

    def save(self, *args, **kwargs):
        if not self.user_uid:
            while True:
                uid = generate_uid()
                if not User.objects.filter(user_uid=uid).exists():
                    self.user_uid = uid
                    break

        if not self.referral_code:
            while True:
                code = generate_uid()
                if not User.objects.filter(referral_code=code).exists():
                    self.referral_code = code
                    break

        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class Referral(models.Model):
    referrer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="referral_records"
    )
    referred_user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="referred_record"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.referrer} → {self.referred_user}"
