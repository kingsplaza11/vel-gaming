import json
import logging
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
    paystack = PaystackService()

    payload = request.body
    signature = request.headers.get("X-Paystack-Signature", "")

    # 🔐 Verify signature
    if not paystack.verify_webhook_signature(payload, signature):
        logger.warning("Invalid Paystack webhook signature")
        return HttpResponse(status=400)

    event_data = json.loads(payload)
    event = event_data.get("event")
    data = event_data.get("data", {})

    logger.info("PAYSTACK WEBHOOK RECEIVED: %s", event)

    # ======================================================
    # WALLET FUNDING
    # ======================================================
    if event in ("charge.success", "charge.failed", "charge.abandoned"):
        reference = data.get("reference")
        paystack_status = data.get("status")  # success | failed | abandoned
        paid_amount = data.get("amount")  # kobo

        try:
            wallet_tx = WalletTransaction.objects.select_for_update().get(
                reference=reference
            )
        except WalletTransaction.DoesNotExist:
            logger.error("Webhook TX not found: %s", reference)
            return HttpResponse(status=200)

        # 🛑 Idempotency guard
        if wallet_tx.meta.get("status") == "completed":
            logger.info("Webhook ignored — already completed: %s", reference)
            return HttpResponse(status=200)

        expected_amount = int(wallet_tx.amount * 100)

        # 🔐 Amount validation
        if paid_amount != expected_amount:
            logger.critical(
                "Webhook amount mismatch ref=%s expected=%s paid=%s",
                reference,
                expected_amount,
                paid_amount,
            )

            wallet_tx.meta.update({
                "status": "failed",
                "reason": "amount_mismatch",
                "paystack_data": data,
                "webhook_processed": True,
            })
            wallet_tx.save(update_fields=["meta"])
            return HttpResponse(status=200)

        # ✅ SUCCESS
        if paystack_status == "success":
            with db_transaction.atomic():
                wallet, _ = Wallet.objects.select_for_update().get_or_create(
                    user=wallet_tx.user
                )
                wallet.balance += wallet_tx.amount
                wallet.save(update_fields=["balance"])

                wallet_tx.meta.update({
                    "status": "completed",
                    "verified": True,
                    "gateway": "paystack",
                    "paystack_data": data,
                    "webhook_processed": True,
                })
                wallet_tx.save(update_fields=["meta"])

            logger.info("Wallet funded via webhook: %s", reference)
            return HttpResponse(status=200)

        # ❌ FAILED / ABANDONED
        wallet_tx.meta.update({
            "status": paystack_status,
            "verified": False,
            "paystack_data": data,
            "webhook_processed": True,
        })
        wallet_tx.save(update_fields=["meta"])
        return HttpResponse(status=200)

    # ======================================================
    # WITHDRAWALS
    # ======================================================
    if event == "transfer.success":
        transfer_code = data.get("transfer_code")

        wallet_tx = WalletTransaction.objects.filter(
            meta__transfer_code=transfer_code
        ).first()

        if not wallet_tx:
            return HttpResponse(status=200)

        if wallet_tx.meta.get("status") == "completed":
            return HttpResponse(status=200)

        with db_transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(
                user=wallet_tx.user
            )
            wallet.locked_balance -= wallet_tx.amount
            wallet.save(update_fields=["locked_balance"])

            wallet_tx.meta.update({
                "status": "completed",
                "webhook_processed": True,
                "paystack_data": data,
            })
            wallet_tx.save(update_fields=["meta"])

        return HttpResponse(status=200)

    if event in ("transfer.failed", "transfer.reversed"):
        transfer_code = data.get("transfer_code")

        wallet_tx = WalletTransaction.objects.filter(
            meta__transfer_code=transfer_code
        ).first()

        if not wallet_tx:
            return HttpResponse(status=200)

        if wallet_tx.meta.get("status") != "processing":
            return HttpResponse(status=200)

        with db_transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(
                user=wallet_tx.user
            )
            wallet.locked_balance -= wallet_tx.amount
            wallet.balance += wallet_tx.amount  # refund
            wallet.save(update_fields=["locked_balance", "balance"])

            wallet_tx.meta.update({
                "status": "failed",
                "webhook_processed": True,
                "paystack_data": data,
            })
            wallet_tx.save(update_fields=["meta"])

        return HttpResponse(status=200)

    return HttpResponse(status=200)
