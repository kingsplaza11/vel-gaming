# Webhook handler for OTPay payment notifications
import json
import logging
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction as db_transaction
from django.conf import settings
from decimal import Decimal

from ..models import Wallet, WalletTransaction

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def otpay_webhook(request):
    """
    OTPay webhook handler for payment notifications
    OTPay will send a POST request when a payment is made to a virtual account
    """
    # Get the raw payload
    payload = request.body.decode('utf-8')
    
    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        logger.error("❌ Invalid JSON payload in OTPay webhook")
        return HttpResponse(status=400)
    
    logger.info(f"🔔 OTPay webhook received: {data}")
    
    # Extract transaction details - adjust based on actual webhook format
    # You'll need to get the exact webhook format from OTPay
    reference = data.get("reference") or data.get("txn_ref")
    amount = data.get("amount")
    status = data.get("status", "").lower()
    account_number = data.get("account_number")
    sender_name = data.get("sender_name")
    
    if not reference or not amount:
        logger.error("Missing reference or amount in webhook")
        return HttpResponse(status=400)
    
    # Find the transaction by reference
    with db_transaction.atomic():
        try:
            wallet_tx = WalletTransaction.objects.select_for_update().get(
                reference=reference
            )
        except WalletTransaction.DoesNotExist:
            logger.error(f"⚠️ Webhook TX not found: {reference}")
            return HttpResponse(status=200)  # Return 200 to acknowledge receipt
        
        # Idempotency check
        if wallet_tx.meta.get("status") == "completed":
            logger.info(f"🔁 Webhook ignored (already completed): {reference}")
            return HttpResponse(status=200)
        
        # Check if this is a successful payment
        if status in ["success", "completed", "paid"]:
            # Process the payment
            wallet, _ = Wallet.objects.select_for_update().get_or_create(
                user=wallet_tx.user
            )
            
            # Split amount equally between balance and spot_balance
            total = Decimal(str(amount))
            half = (total / Decimal("2")).quantize(Decimal("0.01"))
            
            wallet.balance += half
            wallet.spot_balance += half
            wallet.save(update_fields=["balance", "spot_balance"])
            
            # Check if first deposit
            has_previous = WalletTransaction.objects.filter(
                user=wallet_tx.user,
                tx_type=WalletTransaction.CREDIT,
                meta__status="completed"
            ).exclude(id=wallet_tx.id).exists()
            
            wallet_tx.first_deposit = not has_previous
            
            # Update transaction
            wallet_tx.meta.update({
                "status": "completed",
                "verified": True,
                "gateway": "otpay",
                "account_number": account_number,
                "sender_name": sender_name,
                "webhook_data": data,
                "distribution": {
                    "total": str(total),
                    "balance": str(half),
                    "spot_balance": str(half),
                }
            })
            wallet_tx.save(update_fields=["meta", "first_deposit"])
            
            logger.info(f"✅ Wallet funded via OTPay: {reference}")
            
        elif status in ["failed", "cancelled"]:
            wallet_tx.meta.update({
                "status": "failed",
                "verified": False,
                "webhook_data": data
            })
            wallet_tx.save(update_fields=["meta"])
            logger.info(f"❌ Payment failed: {reference}")
    
    return HttpResponse(status=200)