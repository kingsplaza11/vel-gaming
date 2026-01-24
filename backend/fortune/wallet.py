# fortune/wallet.py
from decimal import Decimal
from django.db import transaction
from wallets.models import Wallet


class WalletError(Exception):
    pass


@transaction.atomic
def debit_for_bet(user_id: int, amount: Decimal, ref: str):
    """
    Debit bet amount using:
    1) wallet.balance (FIRST)
    2) wallet.spot_balance (IF NEEDED)

    Total debited amount is moved into locked_balance.
    """

    if amount <= 0:
        raise WalletError("Invalid bet amount")

    wallet = Wallet.objects.select_for_update().get(user_id=user_id)

    total_available = wallet.balance + wallet.spot_balance
    if total_available < amount:
        raise WalletError("Insufficient funds")

    remaining = amount

    # 1️⃣ Use MAIN balance first
    used_from_balance = min(wallet.balance, remaining)
    wallet.balance -= used_from_balance
    remaining -= used_from_balance

    # 2️⃣ Use SPOT balance if needed
    if remaining > 0:
        used_from_spot = min(wallet.spot_balance, remaining)
        wallet.spot_balance -= used_from_spot
        remaining -= used_from_spot

    # Sanity check (should never fail)
    if remaining != Decimal("0"):
        raise WalletError("Debit calculation error")

    wallet.save(update_fields=[
        "balance",
        "spot_balance",
        "locked_balance",
    ])

@transaction.atomic
def credit_payout(user_id: int, payout: Decimal, ref: str):
    """
    Resolve game outcome.
    - locked_balance is always released
    - payout is credited to SPOT BALANCE
    """
    if payout < 0:
        raise WalletError("Invalid payout amount")

    wallet = Wallet.objects.select_for_update().get(user_id=user_id)

    # Release locked funds
    wallet.locked_balance = Decimal("0.00")

    # Credit payout to SPOT balance only
    wallet.spot_balance += payout

    wallet.save(
        update_fields=["spot_balance", "locked_balance"]
    )
