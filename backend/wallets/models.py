from django.conf import settings
from django.db import models
from decimal import Decimal
import random

class Wallet(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wallet",
    )
    balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    locked_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    spot_balance = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet({self.user_id})"


class WalletTransaction(models.Model):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"
    TX_TYPE_CHOICES = [
        (DEBIT, "Debit"),
        (CREDIT, "Credit"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet_txs"
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    tx_type = models.CharField(max_length=6, choices=TX_TYPE_CHOICES)
    reference = models.CharField(max_length=64, unique=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    first_deposit = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
        ]

    def __str__(self):
        return f"{self.tx_type} {self.amount} for {self.user_id}"


class AdminBank(models.Model):
    """
    Admin-configured bank accounts that users will pay into for deposits
    """
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=30, unique=True)
    account_name = models.CharField(max_length=100)
    
    # Bank details
    branch = models.CharField(max_length=100, blank=True)
    swift_code = models.CharField(max_length=20, blank=True)
    routing_number = models.CharField(max_length=20, blank=True)
    
    # Deposit limits for this bank account
    daily_deposit_limit = models.DecimalField(
        max_digits=18, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Maximum total deposits allowed per day for this bank account"
    )
    monthly_deposit_limit = models.DecimalField(
        max_digits=18, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Maximum total deposits allowed per month for this bank account"
    )
    min_deposit_amount = models.DecimalField(
        max_digits=18, 
        decimal_places=2, 
        default=100.00,
        help_text="Minimum amount per deposit for this bank account"
    )
    max_deposit_amount = models.DecimalField(
        max_digits=18, 
        decimal_places=2, 
        null=True, 
        blank=True,
        help_text="Maximum amount per deposit for this bank account"
    )
    
    # Bank status
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Default bank account to show users")
    
    # Metadata
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['?']  # Random ordering
        indexes = [
            models.Index(fields=['is_active', 'is_default']),
            models.Index(fields=['account_number']),
        ]

    def __str__(self):
        return f"{self.bank_name} - {self.account_number} ({self.account_name})"
    
    def save(self, *args, **kwargs):
        # Ensure only one default bank
        if self.is_default:
            AdminBank.objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)
    
    @classmethod
    def get_random_active_banks(cls, limit=None):
        """
        Returns random active banks
        """
        queryset = cls.objects.filter(is_active=True)
        if limit:
            # Convert to list and return random sample
            banks = list(queryset)
            return random.sample(banks, min(limit, len(banks)))
        return queryset.order_by('?')


class WithdrawalRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withdrawal_requests")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Bank details at time of withdrawal
    account_number = models.CharField(max_length=20)
    bank_code = models.CharField(max_length=10)
    bank_name = models.CharField(max_length=100)
    account_name = models.CharField(max_length=100)
    
    reference = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True)
    processing_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('50.00'))
    
    # Metadata
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.amount} - {self.status}"
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['reference']),
            models.Index(fields=['created_at']),
        ]


class DepositRequest(models.Model):
    """
    Model for tracking deposit requests from users - only bank transfer method
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="deposit_requests")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Admin bank account being paid into
    admin_bank = models.ForeignKey(
        AdminBank, 
        on_delete=models.PROTECT,
        related_name="deposit_requests",
        help_text="Admin bank account that user is paying into"
    )
    
    # User's payment details (source bank)
    source_bank_name = models.CharField(max_length=100, blank=True)
    source_account_number = models.CharField(max_length=30, blank=True)
    source_account_name = models.CharField(max_length=100, blank=True)
    
    # Transaction details
    reference = models.CharField(max_length=50, unique=True)
    transaction_reference = models.CharField(max_length=100, blank=True, help_text="Reference from payment gateway/bank")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Fee
    processing_fee = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    
    # Proof of payment
    proof_of_payment = models.FileField(upload_to='deposit_proofs/%Y/%m/%d/', null=True, blank=True)
    admin_notes = models.TextField(blank=True)
    
    # Timestamps
    approved_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['reference']),
            models.Index(fields=['transaction_reference']),
            models.Index(fields=['created_at']),
            models.Index(fields=['status', 'expires_at']),
            models.Index(fields=['admin_bank', 'status']),
        ]

    def __str__(self):
        return f"Deposit {self.reference} - {self.user.username} - {self.amount} - {self.status}"
    
    @property
    def net_amount(self):
        """Amount after fees"""
        return self.amount - self.processing_fee


class DepositLimit(models.Model):
    """
    Model for managing deposit limits per user or globally
    """
    PERIOD_CHOICES = [
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name="deposit_limits"
    )
    
    # If user is null, this is a global/default limit
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES, default='daily')
    max_amount = models.DecimalField(max_digits=18, decimal_places=2)
    min_amount = models.DecimalField(max_digits=18, decimal_places=2, default=100.00)
    
    # Apply to specific admin bank or all banks
    admin_bank = models.ForeignKey(
        AdminBank, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name="deposit_limits"
    )
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['period']
        unique_together = [['user', 'period', 'admin_bank']]
        indexes = [
            models.Index(fields=['user', 'is_active']),
            models.Index(fields=['admin_bank', 'is_active']),
        ]
    
    def __str__(self):
        if self.user:
            return f"{self.user.username} - {self.period} limit: {self.max_amount}"
        return f"Global - {self.period} limit: {self.max_amount}"


class UnmatchedWebhook(models.Model):
    reference = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    payload = models.JSONField(default=dict)
    gateway = models.CharField(max_length=50, default='otpay')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed = models.BooleanField(default=False, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['gateway', 'processed', 'created_at']),
        ]
    
    def __str__(self):
        return f"Unmatched {self.gateway} webhook: {self.reference or 'no-ref'} - {self.created_at}"