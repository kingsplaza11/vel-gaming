# accounts/signals.py
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from decimal import Decimal, InvalidOperation
import re
import random
import string
from django.db.models.signals import post_save

User = get_user_model()

@receiver(pre_save, sender=User)
def validate_user_decimal_fields(sender, instance, **kwargs):
    """
    Ensure all Decimal fields are properly converted before saving
    """
    decimal_fields = ['balance']  # Add other decimal fields if you have them
    
    for field in decimal_fields:
        if hasattr(instance, field):
            value = getattr(instance, field)
            if value is not None:
                try:
                    # If it's a string, clean it first
                    if isinstance(value, str):
                        # Remove any non-numeric characters except . and -
                        cleaned_value = re.sub(r'[^\d.-]', '', value)
                        if cleaned_value:
                            value = Decimal(cleaned_value)
                        else:
                            value = Decimal('0.00')
                    
                    # Ensure it's a Decimal
                    if not isinstance(value, Decimal):
                        value = Decimal(str(value))
                        
                    setattr(instance, field, value)
                    
                except (InvalidOperation, ValueError, TypeError):
                    # Set to default value if conversion fails
                    setattr(instance, field, Decimal('0.00'))


def generate_ref_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

@receiver(post_save, sender=User)
def create_referral_code(sender, instance, created, **kwargs):
    if created and not instance.referral_code:
        instance.referral_code = generate_ref_code()
        instance.save()


def generate_unique_code(field_name, length=8):
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(chars, k=length))
        if not User.objects.filter(**{field_name: code}).exists():
            return code

@receiver(post_save, sender=User)
def assign_user_codes(sender, instance, created, **kwargs):
    if not created:
        return

    updates = {}

    if not instance.referral_code:
        updates["referral_code"] = generate_unique_code("referral_code", 8)

    if not instance.user_uid:
        updates["user_uid"] = generate_unique_code("user_uid", 8)

    if updates:
        User.objects.filter(pk=instance.pk).update(**updates)
