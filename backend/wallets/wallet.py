from rest_framework import serializers
from decimal import Decimal
from django.db import transaction as db_transaction
from .models import Wallet, WalletTransaction

class FundWalletSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=18, decimal_places=2, min_value=Decimal('100.00'))
    email = serializers.EmailField()
    
    def validate_amount(self, value):
        if value < Decimal('100.00'):
            raise serializers.ValidationError("Minimum funding amount is 100.00")
        return value

from .models import WithdrawalRequest

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
        return value

class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ['id', 'amount', 'tx_type', 'reference', 'meta', 'created_at']

class WalletSerializer(serializers.ModelSerializer):
    transactions = WalletTransactionSerializer(many=True, read_only=True)
    total_balance = serializers.SerializerMethodField()
    
    class Meta:
        model = Wallet
        fields = ['balance', 'spot_balance', 'locked_balance', 'total_balance', 'updated_at', 'transactions']
    
    def get_total_balance(self, obj):
        # Calculate total available balance (balance + spot_balance, excluding locked_balance)
        return obj.balance + obj.spot_balance