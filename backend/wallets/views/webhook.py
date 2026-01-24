import json
import hmac
import hashlib
import logging
from decimal import Decimal

from django.conf import settings
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction as db_transaction

from ..models import Wallet, WalletTransaction
from ..paystack import PaystackService

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def paystack_webhook(request):
    payload = request.body
    signature = request.headers.get("X-Paystack-Signature")

    # -------------------------------------------------
    # 1️⃣ Verify signature (MANDATORY)
    # -------------------------------------------------
    computed_signature = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512
    ).hexdigest()

    if signature != computed_signature:
        logger.warning("❌ Invalid Paystack webhook signature")
        return HttpResponse(status=400)

    event_data = json.loads(payload)
    event = event_data.get("event")
    data = event_data.get("data", {})

    reference = data.get("reference")
    status_ = data.get("status")
    amount_kobo = data.get("amount")

    logger.info("🔔 Paystack webhook: %s | ref=%s", event, reference)

    # -------------------------------------------------
    # 2️⃣ Wallet Funding Events
    # -------------------------------------------------
    if event in ("charge.success", "charge.failed", "charge.abandoned"):

        if not reference:
            return HttpResponse(status=200)

        with db_transaction.atomic():
            try:
                wallet_tx = (
                    WalletTransaction.objects
                    .select_for_update()
                    .get(reference=reference)
                )
            except WalletTransaction.DoesNotExist:
                logger.error("⚠️ Webhook TX not found: %s", reference)
                return HttpResponse(status=200)

            # 🛑 HARD IDEMPOTENCY
            if wallet_tx.meta.get("status") == "completed":
                logger.info("🔁 Webhook ignored (already completed): %s", reference)
                return HttpResponse(status=200)

            expected_amount = int(wallet_tx.amount * 100)

            if amount_kobo != expected_amount:
                wallet_tx.meta.update({
                    "status": "failed",
                    "reason": "amount_mismatch",
                    "paystack_data": data,
                    "webhook_processed": True,
                })
                wallet_tx.save(update_fields=["meta"])
                logger.critical("💥 Amount mismatch for %s", reference)
                return HttpResponse(status=200)

            # ✅ SUCCESS
            if status_ == "success":
                wallet, _ = Wallet.objects.select_for_update().get_or_create(
                    user=wallet_tx.user
                )

                # Check if this is the first successful deposit for this user
                if wallet_tx.tx_type == WalletTransaction.CREDIT:
                    has_previous_successful_deposit = WalletTransaction.objects.filter(
                        user=wallet_tx.user,
                        tx_type=WalletTransaction.CREDIT,
                        meta__status="completed"
                    ).exclude(id=wallet_tx.id).exists()
                    
                    # Set first_deposit to True if this is the first successful deposit
                    # and keep it False otherwise
                    wallet_tx.first_deposit = not has_previous_successful_deposit

                total = wallet_tx.amount
                half = (total / Decimal("2")).quantize(Decimal("0.01"))

                wallet.balance += half
                wallet.spot_balance += half
                wallet.save(update_fields=["balance", "spot_balance"])

                wallet_tx.meta.update({
                    "status": "completed",
                    "verified": True,
                    "gateway": "paystack",
                    "distribution": {
                        "total": str(total),
                        "balance": str(half),
                        "spot_balance": str(half),
                    },
                    "paystack_data": data,
                    "webhook_processed": True,
                })
                # Save both meta and first_deposit field
                wallet_tx.save(update_fields=["meta", "first_deposit"])

                logger.info("✅ Wallet funded via webhook: %s", reference)
                if wallet_tx.first_deposit:
                    logger.info("🎉 First deposit for user %s", wallet_tx.user_id)
                return HttpResponse(status=200)

            # ❌ FAILED / ABANDONED
            wallet_tx.meta.update({
                "status": status_,
                "verified": False,
                "paystack_data": data,
                "webhook_processed": True,
            })
            # Keep first_deposit as False for failed transactions
            wallet_tx.save(update_fields=["meta"])

            return HttpResponse(status=200)

    # -------------------------------------------------
    # 3️⃣ Withdrawal Webhooks (unchanged logic)
    # -------------------------------------------------
    if event == "transfer.success":
        transfer_code = data.get("transfer_code")

        with db_transaction.atomic():
            wallet_tx = (
                WalletTransaction.objects
                .select_for_update()
                .filter(meta__transfer_code=transfer_code)
                .first()
            )

            if not wallet_tx or wallet_tx.meta.get("status") == "completed":
                return HttpResponse(status=200)

            wallet = Wallet.objects.select_for_update().get(user=wallet_tx.user)
            wallet.locked_balance -= wallet_tx.amount
            wallet.save(update_fields=["locked_balance"])

            wallet_tx.meta.update({
                "status": "completed",
                "paystack_data": data,
                "webhook_processed": True,
            })
            wallet_tx.save(update_fields=["meta"])

        return HttpResponse(status=200)

    if event in ("transfer.failed", "transfer.reversed"):
        transfer_code = data.get("transfer_code")

        with db_transaction.atomic():
            wallet_tx = (
                WalletTransaction.objects
                .select_for_update()
                .filter(meta__transfer_code=transfer_code)
                .first()
            )

            if not wallet_tx or wallet_tx.meta.get("status") != "processing":
                return HttpResponse(status=200)

            wallet = Wallet.objects.select_for_update().get(user=wallet_tx.user)
            wallet.locked_balance -= wallet_tx.amount
            wallet.balance += wallet_tx.amount
            wallet.save(update_fields=["locked_balance", "balance"])

            wallet_tx.meta.update({
                "status": "failed",
                "paystack_data": data,
                "webhook_processed": True,
            })
            wallet_tx.save(update_fields=["meta"])

        return HttpResponse(status=200)

    return HttpResponse(status=200)