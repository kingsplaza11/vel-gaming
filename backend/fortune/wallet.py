# fortune/wallet.py
from decimal import Decimal
from django.db import transaction
from wallets.models import Wallet


class WalletError(Exception):
    pass


@transaction.atomic
def debit_for_bet(user_id: int, amount: Decimal, ref: str):
    """
    Debit wallet when a Fortune game session starts.
    Moves bet amount into locked_balance.
    """
    if amount <= 0:
        raise WalletError("Invalid bet amount")

    wallet = Wallet.objects.select_for_update().get(user_id=user_id)

    if wallet.balance < amount:
        raise WalletError("Insufficient balance")

    wallet.balance -= amount
    wallet.locked_balance += amount

    wallet.save(update_fields=["balance", "locked_balance"])


@transaction.atomic
def credit_payout(user_id: int, payout: Decimal, ref: str):
    """
    Resolve locked balance after game ends.
    - locked_balance is always fully released
    - payout is credited to balance
    """
    if payout < 0:
        raise WalletError("Invalid payout amount")

    wallet = Wallet.objects.select_for_update().get(user_id=user_id)

    # Release all locked funds
    locked = wallet.locked_balance
    wallet.locked_balance = Decimal("0.00")

    # Credit payout
    wallet.balance += payout

    wallet.save(update_fields=["balance", "locked_balance"])
