from wallets.models import Wallet
from django.db import transaction
from decimal import Decimal

@transaction.atomic
def debit_wallet(user, amount):
    wallet = Wallet.objects.select_for_update().get(user=user)
    if wallet.balance < amount:
        raise ValueError("Insufficient balance")
    wallet.balance -= amount
    wallet.save()
    return wallet

@transaction.atomic
def credit_wallet(user, amount):
    wallet = Wallet.objects.select_for_update().get(user=user)
    wallet.balance += Decimal(amount)
    wallet.save()
