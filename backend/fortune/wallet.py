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
    - wallet.balance
    - wallet.spot_balance
    - or BOTH combined

    Priority:
    1) spot_balance
    2) balance

    Bet is moved into locked_balance.
    """
    if amount <= 0:
        raise WalletError("Invalid bet amount")

    wallet = Wallet.objects.select_for_update().get(user_id=user_id)

    available = wallet.balance + wallet.spot_balance

    if available < amount:
        raise WalletError("Insufficient funds")

    remaining = amount

    # 1️⃣ Use spot balance first
    if wallet.spot_balance > 0:
        used_from_spot = min(wallet.spot_balance, remaining)
        wallet.spot_balance -= used_from_spot
        remaining -= used_from_spot

    # 2️⃣ Use main balance if needed
    if remaining > 0:
        wallet.balance -= remaining

    # 3️⃣ Lock full bet
    wallet.locked_balance += amount

    wallet.save(
        update_fields=["balance", "spot_balance", "locked_balance"]
    )

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
