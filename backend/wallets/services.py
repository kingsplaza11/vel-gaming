from decimal import Decimal
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .models import Wallet, WalletTransaction
from crash.models import AuditLog


# ======================================================
# INTERNAL
# ======================================================
def _get_wallet_for_update(user):
    return Wallet.objects.select_for_update().get(user=user)


# ======================================================
# PLACE BET (USES balance + spot_balance)
# ======================================================
@transaction.atomic
def place_bet_atomic(user, amount: Decimal, reference: str):
    wallet = _get_wallet_for_update(user)

    if amount <= 0:
        raise ValueError("Invalid bet amount")

    available = wallet.balance + wallet.spot_balance
    if available < amount:
        raise ValueError("Insufficient funds")

    remaining = amount

    # 1️⃣ Spend from spot balance first
    if wallet.spot_balance > 0:
        used_spot = min(wallet.spot_balance, remaining)
        wallet.spot_balance = F("spot_balance") - used_spot
        remaining -= used_spot

    # 2️⃣ Spend remaining from main balance
    if remaining > 0:
        wallet.balance = F("balance") - remaining

    # 3️⃣ Lock full bet
    wallet.locked_balance = F("locked_balance") + amount

    wallet.save(update_fields=["balance", "spot_balance", "locked_balance"])

    tx = WalletTransaction.objects.create(
        user=user,
        amount=amount,
        tx_type=WalletTransaction.DEBIT,
        reference=reference,
        meta={"reason": "crash_bet"},
    )

    AuditLog.objects.create(
        user=user,
        action="BET_PLACED",
        details={"amount": str(amount), "reference": reference},
    )

    return tx


# ======================================================
# CASHOUT (CREDITS SPOT BALANCE ONLY)
# ======================================================
@transaction.atomic
def cashout_atomic(user, bet, payout_amount: Decimal, reference: str):
    wallet = _get_wallet_for_update(user)

    if bet.status != "ACTIVE":
        raise ValueError("Bet not active")

    if payout_amount < 0:
        raise ValueError("Invalid payout amount")

    # Release locked funds (always)
    wallet.locked_balance = F("locked_balance") - bet.bet_amount

    # Credit winnings to SPOT balance
    wallet.spot_balance = F("spot_balance") + payout_amount

    wallet.save(update_fields=["locked_balance", "spot_balance"])

    tx = WalletTransaction.objects.create(
        user=user,
        amount=payout_amount,
        tx_type=WalletTransaction.CREDIT,
        reference=reference,
        meta={"reason": "crash_cashout", "bet_id": bet.id},
    )

    bet.win_amount = payout_amount
    bet.status = "CASHED_OUT"
    bet.cashed_out_at = timezone.now()
    bet.save(update_fields=["win_amount", "status", "cashed_out_at"])

    AuditLog.objects.create(
        user=user,
        action="CASHOUT",
        details={"bet_id": bet.id, "payout": str(payout_amount), "reference": reference},
    )

    return tx


# ======================================================
# LOST BET (NO REFUND, JUST RELEASE LOCK)
# ======================================================
@transaction.atomic
def settle_lost_bet_atomic(bet):
    wallet = Wallet.objects.select_for_update().get(user=bet.user)

    wallet.locked_balance = F("locked_balance") - bet.bet_amount
    wallet.save(update_fields=["locked_balance"])

    bet.status = "LOST"
    bet.win_amount = Decimal("0.00")
    bet.save(update_fields=["status", "win_amount"])
