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


def process_auto_cashout(user, bet, payout_amount, reference, is_demo=False):
    """
    Process an auto cashout for a crash bet and add winnings to wallet spot balance.
    
    Args:
        user: The user who placed the bet
        bet: The CrashBet instance
        payout_amount: Decimal amount to pay out
        reference: Transaction reference string
        is_demo: Whether this is a demo transaction
        
    Returns:
        Decimal: The new wallet balance after cashout
    """
    with transaction.atomic():
        try:
            # Get the wallet with lock to prevent race conditions
            wallet = Wallet.objects.select_for_update().get(
                user=user
            )
            
            # Add the payout to spot balance (original bet was already deducted)
            wallet.spot_balance += payout_amount
            wallet.balance = wallet.spot_balance + wallet.bonus_balance
            wallet.save()
            
            # Record the transaction
            Transaction.objects.create(
                wallet=wallet,
                transaction_type="CRASH_WIN",
                amount=payout_amount,
                balance_before=wallet.spot_balance - payout_amount,
                balance_after=wallet.spot_balance,
                reference=reference,
                description=f"Crash auto cashout at {bet.cashout_multiplier}x",
                status="COMPLETED",
                metadata={
                    "bet_id": bet.id,
                    "round_id": bet.round.id,
                    "crash_multiplier": str(bet.cashout_multiplier),
                    "auto_cashout": True,
                    "original_bet": str(bet.bet_amount),
                    "payout_multiplier": str(bet.cashout_multiplier)
                }
            )
            
            logger.info(f"Auto cashout processed for user {user.id}: "
                       f"bet {bet.id}, payout {payout_amount}, "
                       f"new balance {wallet.spot_balance}")
            
            return wallet.spot_balance
            
        except Exception as e:
            logger.error(f"Failed to process auto cashout for user {user.id}, "
                        f"bet {bet.id}: {str(e)}")
            raise ValueError(f"Auto cashout failed: {str(e)}")