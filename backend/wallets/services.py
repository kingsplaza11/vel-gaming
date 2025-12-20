from decimal import Decimal
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import Wallet, WalletTransaction
from crash.models import AuditLog

def _get_wallet_for_update(user, is_demo: bool):
    wallet = Wallet.objects.select_for_update().get(user=user)
    return wallet


@transaction.atomic
def place_bet_atomic(user, amount: Decimal, reference: str, is_demo: bool = False):
    wallet = _get_wallet_for_update(user, is_demo=is_demo)

    if amount <= 0:
        raise ValueError("Invalid bet amount")

    if is_demo:
        if wallet.demo_balance < amount:
            raise ValueError("Insufficient demo balance")
        wallet.demo_balance = F("demo_balance") - amount
    else:
        if wallet.balance < amount:
            raise ValueError("Insufficient balance")
        wallet.balance = F("balance") - amount
        wallet.locked_balance = F("locked_balance") + amount

    wallet.save(update_fields=["balance", "locked_balance", "demo_balance"])

    tx = WalletTransaction.objects.create(
        user=user,
        amount=amount,
        tx_type=WalletTransaction.DEBIT,
        reference=reference,
        meta={"reason": "crash_bet", "is_demo": is_demo},
    )

    AuditLog.objects.create(
        user=user,
        action="BET_PLACED",
        details={"amount": str(amount), "reference": reference, "is_demo": is_demo},
    )

    return tx


@transaction.atomic
def cashout_atomic(user, bet, payout_amount: Decimal, reference: str, is_demo: bool = False):
    wallet = _get_wallet_for_update(user, is_demo=is_demo)

    if bet.status != "ACTIVE":
        raise ValueError("Bet not active")

    if payout_amount <= 0:
        raise ValueError("Invalid payout amount")

    if is_demo:
        wallet.demo_balance = F("demo_balance") + payout_amount
    else:
        # unlock bet amount and add profit
        locked = bet.bet_amount
        wallet.locked_balance = F("locked_balance") - locked
        wallet.balance = F("balance") + payout_amount

    wallet.save(update_fields=["balance", "locked_balance", "demo_balance"])

    tx = WalletTransaction.objects.create(
        user=user,
        amount=payout_amount,
        tx_type=WalletTransaction.CREDIT,
        reference=reference,
        meta={"reason": "crash_cashout", "bet_id": bet.id, "is_demo": is_demo},
    )

    bet.win_amount = payout_amount
    bet.status = "CASHED_OUT"
    bet.cashed_out_at = timezone.now()
    bet.save(update_fields=["win_amount", "status", "cashed_out_at", "cashout_multiplier"])

    AuditLog.objects.create(
        user=user,
        action="CASHOUT",
        details={"bet_id": bet.id, "payout": str(payout_amount), "reference": reference},
    )

    return tx


@transaction.atomic
def settle_lost_bet_atomic(bet, is_demo: bool = False):
    """
    For real money, unlock locked_balance without refunding.
    """
    from decimal import Decimal
    wallet = Wallet.objects.select_for_update().get(user=bet.user)
    if not is_demo:
        wallet.locked_balance = F("locked_balance") - bet.bet_amount
        wallet.save(update_fields=["locked_balance"])
    bet.status = "LOST"
    bet.win_amount = Decimal("0")
    bet.save(update_fields=["status", "win_amount"])
