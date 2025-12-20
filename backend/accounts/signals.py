# accounts/signals.py
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from decimal import Decimal, InvalidOperation
import re

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