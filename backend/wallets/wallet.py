from rest_framework import serializers
from decimal import Decimal
from django.db import transaction as db_transaction
from .models import Wallet, WalletTransaction, WithdrawalRequest, DepositRequest, AdminBank, DepositLimit

# ============= DEPOSIT SERIALIZERS =============

class AdminBankSerializer(serializers.ModelSerializer):
    """
    Serializer for admin bank accounts
    """
    class Meta:
        model = AdminBank
        fields = [
            'id', 'bank_name', 'account_number', 'account_name',
            'min_deposit_amount', 'max_deposit_amount', 'is_default'
        ]


class CreateDepositRequestSerializer(serializers.Serializer):
    """
    Serializer for creating a deposit request
    """
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal('100.00'))
    admin_bank_id = serializers.IntegerField()
    source_bank_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    source_account_number = serializers.CharField(required=False, allow_blank=True, max_length=30)
    source_account_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    
    def validate_amount(self, value):
        if value < Decimal('100.00'):
            raise serializers.ValidationError("Minimum deposit amount is ₦100.00")
        if value > Decimal('10000000.00'):
            raise serializers.ValidationError("Maximum deposit amount is ₦10,000,000.00")
        return value
    
    def validate_admin_bank_id(self, value):
        try:
            bank = AdminBank.objects.get(id=value, is_active=True)
            # Store bank in context for later use
            self.context['bank'] = bank
        except AdminBank.DoesNotExist:
            raise serializers.ValidationError("Invalid bank selection")
        return value
    
    def validate(self, data):
        bank = self.context.get('bank')
        amount = data.get('amount')
        
        if bank:
            # Check bank-specific limits
            if amount < bank.min_deposit_amount:
                raise serializers.ValidationError({
                    'amount': f"Minimum deposit for {bank.bank_name} is ₦{bank.min_deposit_amount}"
                })
            
            if bank.max_deposit_amount and amount > bank.max_deposit_amount:
                raise serializers.ValidationError({
                    'amount': f"Maximum deposit for {bank.bank_name} is ₦{bank.max_deposit_amount}"
                })
        
        return data


class DepositRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for deposit requests
    """
    bank_details = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()
    
    class Meta:
        model = DepositRequest
        fields = [
            'id', 'reference', 'amount', 'status', 'status_display',
            'source_bank_name', 'source_account_number', 'source_account_name',
            'processing_fee', 'admin_notes', 'created_at', 'updated_at',
            'approved_at', 'completed_at', 'expires_at', 'bank_details',
            'transaction_reference'
        ]
    
    def get_bank_details(self, obj):
        """Get admin bank details"""
        if obj.admin_bank:
            return {
                'bank_name': obj.admin_bank.bank_name,
                'account_number': obj.admin_bank.account_number,
                'account_name': obj.admin_bank.account_name,
            }
        return None
    
    def get_status_display(self, obj):
        """Get human-readable status"""
        return obj.get_status_display()


class DepositLimitSerializer(serializers.ModelSerializer):
    """
    Serializer for deposit limits
    """
    class Meta:
        model = DepositLimit
        fields = [
            'id', 'period', 'max_amount', 'min_amount',
            'payment_method', 'is_active', 'created_at', 'updated_at'
        ]


class MarkAsPaidSerializer(serializers.Serializer):
    """
    Serializer for marking a deposit as paid
    """
    deposit_request_id = serializers.IntegerField(required=False)
    reference = serializers.CharField(required=False, max_length=50)
    
    def validate(self, data):
        if not data.get('deposit_request_id') and not data.get('reference'):
            raise serializers.ValidationError("Either deposit_request_id or reference is required")
        return data


# ============= FUND/WALLET SERIALIZERS =============

class FundWalletSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal('100.00'))
    email = serializers.EmailField(required=False, allow_blank=True)
    
    def validate_amount(self, value):
        if value < Decimal('100.00'):
            raise serializers.ValidationError("Minimum funding amount is 100.00")
        return value


# ============= WITHDRAWAL SERIALIZERS =============

class WithdrawalSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=18, 
        decimal_places=2, 
        min_value=Decimal('2000.00')
    )
    account_number = serializers.CharField(max_length=10)
    bank_code = serializers.CharField(max_length=10)
    bank_name = serializers.CharField(max_length=100)
    account_name = serializers.CharField(max_length=100)
    
    def validate_amount(self, value):
        if value < Decimal('2000.00'):
            raise serializers.ValidationError("Minimum withdrawal amount is ₦2,000.00")
        if value > Decimal('10000000.00'):
            raise serializers.ValidationError("Maximum withdrawal amount is ₦10,000,000.00")
        return value
    
    def validate_account_number(self, value):
        if len(value) != 10:
            raise serializers.ValidationError("Account number must be 10 digits")
        if not value.isdigit():
            raise serializers.ValidationError("Account number must contain only digits")
        return value


class WithdrawalRequestSerializer(serializers.ModelSerializer):
    """
    Serializer for withdrawal requests
    """
    status_display = serializers.SerializerMethodField()
    net_amount = serializers.SerializerMethodField()
    
    class Meta:
        model = WithdrawalRequest
        fields = [
            'id', 'reference', 'amount', 'net_amount', 'status', 'status_display',
            'account_number', 'bank_code', 'bank_name', 'account_name',
            'processing_fee', 'admin_notes', 'created_at', 'updated_at'
        ]
    
    def get_status_display(self, obj):
        return obj.get_status_display()
    
    def get_net_amount(self, obj):
        return obj.amount - obj.processing_fee


# ============= TRANSACTION SERIALIZERS =============

class WalletTransactionSerializer(serializers.ModelSerializer):
    tx_type_display = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    
    class Meta:
        model = WalletTransaction
        fields = [
            'id', 'amount', 'tx_type', 'tx_type_display', 
            'reference', 'meta', 'created_at', 'first_deposit',
            'status'
        ]
    
    def get_tx_type_display(self, obj):
        return obj.get_tx_type_display()
    
    def get_status(self, obj):
        return obj.meta.get('status', 'completed') if obj.meta else 'completed'


class WalletSerializer(serializers.ModelSerializer):
    transactions = serializers.SerializerMethodField()
    total_balance = serializers.SerializerMethodField()
    available_balance = serializers.SerializerMethodField()
    
    class Meta:
        model = Wallet
        fields = [
            'balance', 'spot_balance', 'locked_balance', 
            'total_balance', 'available_balance', 'updated_at', 
            'transactions'
        ]
    
    def get_total_balance(self, obj):
        # Calculate total balance (balance + spot_balance, excluding locked_balance)
        return obj.balance + obj.spot_balance
    
    def get_available_balance(self, obj):
        # Available for withdrawal (spot_balance only)
        return obj.spot_balance
    
    def get_transactions(self, obj):
        # Get recent transactions (last 20)
        transactions = WalletTransaction.objects.filter(user=obj.user).order_by('-created_at')[:20]
        return WalletTransactionSerializer(transactions, many=True).data


# ============= VALIDATION SERIALIZERS =============

class ValidateDepositAmountSerializer(serializers.Serializer):
    """
    Serializer for validating deposit amount against bank limits
    """
    amount = serializers.DecimalField(max_digits=18, decimal_places=2)
    bank_id = serializers.IntegerField()
    
    def validate(self, data):
        amount = data.get('amount')
        bank_id = data.get('bank_id')
        
        try:
            bank = AdminBank.objects.get(id=bank_id, is_active=True)
        except AdminBank.DoesNotExist:
            raise serializers.ValidationError({"bank_id": "Invalid bank selection"})
        
        errors = {}
        
        if amount < bank.min_deposit_amount:
            errors['amount'] = f"Minimum deposit for {bank.bank_name} is ₦{bank.min_deposit_amount}"
        
        if bank.max_deposit_amount and amount > bank.max_deposit_amount:
            errors['amount'] = f"Maximum deposit for {bank.bank_name} is ₦{bank.max_deposit_amount}"
        
        if errors:
            raise serializers.ValidationError(errors)
        
        data['bank'] = bank
        return data


class BankAccountResolverSerializer(serializers.Serializer):
    """
    Serializer for bank account resolution
    """
    bank_code = serializers.CharField(max_length=10)
    account_number = serializers.CharField(max_length=10)
    
    def validate_account_number(self, value):
        if len(value) != 10:
            raise serializers.ValidationError("Account number must be 10 digits")
        if not value.isdigit():
            raise serializers.ValidationError("Account number must contain only digits")
        return value