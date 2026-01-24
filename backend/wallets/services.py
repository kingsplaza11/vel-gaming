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
# PLACE BET (USES wallet balance first, then spot balance)
# ======================================================
@transaction.atomic
def place_bet_atomic(user, amount: Decimal, reference: str):
    wallet = _get_wallet_for_update(user)

    if amount <= 0:
        raise ValueError("Invalid bet amount")

    remaining = amount
    
    # Track how much is taken from each source
    taken_from_wallet = Decimal('0')
    taken_from_spot = Decimal('0')

    # 1️⃣ Try to spend from wallet balance first
    if wallet.balance > 0:
        taken_from_wallet = min(wallet.balance, remaining)
        wallet.balance = F("balance") - taken_from_wallet
        remaining -= taken_from_wallet

    # 2️⃣ If still remaining, spend from spot balance
    if remaining > 0 and wallet.spot_balance > 0:
        taken_from_spot = min(wallet.spot_balance, remaining)
        wallet.spot_balance = F("spot_balance") - taken_from_spot
        remaining -= taken_from_spot

    # 3️⃣ Check if we have enough funds in total
    if remaining > 0:
        raise ValueError("Insufficient funds")

    wallet.save(update_fields=["balance", "spot_balance"])

    tx = WalletTransaction.objects.create(
        user=user,
        amount=amount,
        tx_type=WalletTransaction.DEBIT,
        reference=reference,
        meta={
            "reason": "crash_bet",
            "taken_from_wallet": str(taken_from_wallet),
            "taken_from_spot": str(taken_from_spot)
        },
    )

    AuditLog.objects.create(
        user=user,
        action="BET_PLACED",
        details={
            "amount": str(amount),
            "reference": reference,
            "wallet_used": str(taken_from_wallet),
            "spot_used": str(taken_from_spot)
        },
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


    # Credit winnings to SPOT balance
    wallet.spot_balance = F("spot_balance") + payout_amount

    wallet.save(update_fields=["spot_balance"])

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

    bet.status = "LOST"
    bet.win_amount = Decimal("0.00")
    bet.save(update_fields=["status", "win_amount"])
