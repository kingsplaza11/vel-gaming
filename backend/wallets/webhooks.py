# wallets/webhooks.py
import json
import logging
import traceback
from decimal import Decimal
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction as db_transaction
from django.utils import timezone
from datetime import timedelta

from .models import Wallet, WalletTransaction, UnmatchedWebhook

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def otpay_webhook(request):
    """
    OTPay webhook handler for payment notifications
    URL: /api/wallet/webhook/otpay/
    
    Expected webhook format from OTPay (based on their API):
    {
        "order_number": "1234567890",
        "account_number": "1234567890",
        "amount": 1000,
        "status": "success",
        "reference": "REF123",
        "transaction_id": "TXN123"
    }
    """
    logger.info("=" * 70)
    logger.info("🔔 OTPAY WEBHOOK RECEIVED")
    logger.info("=" * 70)
    
    # Log all request details for debugging
    logger.info(f"📋 Request method: {request.method}")
    logger.info(f"📋 Headers: {dict(request.headers)}")
    logger.info(f"📋 Content type: {request.content_type}")
    
    # Get raw payload
    try:
        payload = request.body.decode('utf-8')
        logger.info(f"📦 Raw payload: {payload}")
    except Exception as e:
        logger.error(f"❌ Failed to decode payload: {str(e)}")
        return HttpResponse(status=400)
    
    # Try to parse JSON
    try:
        data = json.loads(payload)
        logger.info(f"📦 Parsed JSON data: {json.dumps(data, indent=2)}")
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON payload: {str(e)}")
        return HttpResponse(status=400)
    
    # Extract important fields from webhook
    # OTPay might send different field names, so we try multiple possibilities
    
    # Order number (most reliable identifier from OTPay)
    order_number = None
    for field in ['order_number', 'order_no', 'orderId', 'order_id', 'order']:
        if field in data and data[field]:
            order_number = str(data[field])
            logger.info(f"✅ Found order_number in field '{field}': {order_number}")
            break
    
    # Account number
    account_number = None
    for field in ['account_number', 'account', 'virtual_account', 'va_number', 'destination_account', 'accountNo']:
        if field in data and data[field]:
            account_number = str(data[field])
            logger.info(f"✅ Found account_number in field '{field}': {account_number}")
            break
    
    # Amount
    amount = None
    for field in ['amount', 'amt', 'total', 'total_amount', 'paid_amount', 'transaction_amount']:
        if field in data and data[field]:
            amount = data[field]
            logger.info(f"✅ Found amount in field '{field}': {amount}")
            break
    
    # Status
    status = None
    for field in ['status', 'transaction_status', 'payment_status', 'state', 'result']:
        if field in data:
            status_val = data[field]
            if isinstance(status_val, str):
                status = status_val.lower()
            else:
                status = str(status_val).lower()
            logger.info(f"✅ Found status in field '{field}': {status}")
            break
    
    # Reference (our internal reference)
    reference = None
    for field in ['reference', 'ref', 'txn_ref', 'transaction_reference', 'custom_ref']:
        if field in data and data[field]:
            reference = str(data[field])
            logger.info(f"✅ Found reference in field '{field}': {reference}")
            break
    
    # Transaction ID (OTPay's internal ID)
    transaction_id = None
    for field in ['transaction_id', 'txn_id', 'id', 'payment_id']:
        if field in data and data[field]:
            transaction_id = str(data[field])
            logger.info(f"✅ Found transaction_id in field '{field}': {transaction_id}")
            break
    
    logger.info("=" * 50)
    logger.info(f"📊 EXTRACTED DATA SUMMARY:")
    logger.info(f"   - Order Number: {order_number}")
    logger.info(f"   - Account Number: {account_number}")
    logger.info(f"   - Amount: {amount}")
    logger.info(f"   - Status: {status}")
    logger.info(f"   - Reference: {reference}")
    logger.info(f"   - Transaction ID: {transaction_id}")
    logger.info("=" * 50)
    
    # Only process successful payments
    success_statuses = ['successful', 'completed', 'success', 'paid', 'approved', 'confirmed', '1', 'true']
    if status and status not in success_statuses:
        logger.info(f"⏭️ Ignoring non-successful payment status: {status}")
        return HttpResponse(status=200)
    
    # We need at least one identifier to find the transaction
    if not order_number and not account_number and not reference:
        logger.error("❌ No identifiers found in webhook data")
        logger.error(f"Full data: {data}")
        
        # Store unmatched webhook for manual review
        try:
            UnmatchedWebhook.objects.create(
                reference='no-identifier',
                amount=Decimal(str(amount)) if amount else None,
                payload=data,
                gateway='otpay'
            )
            logger.info("📝 Stored unmatched webhook in database")
        except Exception as e:
            logger.error(f"Failed to store unmatched webhook: {str(e)}")
        
        return HttpResponse(status=200)
    
    # Process the payment - FIND EXACTLY ONE TRANSACTION
    try:
        with db_transaction.atomic():
            logger.info("🔄 Starting database transaction")
            
            wallet_tx = None
            matching_method = None
            
            # METHOD 1: Try to find by order_number (most reliable if OTPay sends it)
            if order_number and not wallet_tx:
                logger.info(f"🔍 METHOD 1: Looking for transaction with order_number: {order_number}")
                
                # Search in meta for order_number
                all_txs = WalletTransaction.objects.filter(
                    tx_type=WalletTransaction.CREDIT,
                    created_at__gte=timezone.now() - timedelta(hours=48)  # Last 48 hours
                ).select_for_update()
                
                for tx in all_txs:
                    tx_order = tx.meta.get('order_number')
                    if tx_order and str(tx_order) == str(order_number):
                        wallet_tx = tx
                        matching_method = "order_number"
                        logger.info(f"✅ Found transaction by order_number: {tx.reference}")
                        break
            
            # METHOD 2: Try exact reference match (our internal reference)
            if reference and not wallet_tx:
                logger.info(f"🔍 METHOD 2: Looking for transaction with reference: {reference}")
                try:
                    wallet_tx = WalletTransaction.objects.select_for_update().get(
                        reference=reference
                    )
                    matching_method = "reference"
                    logger.info(f"✅ Found transaction by exact reference match: {wallet_tx.reference}")
                except WalletTransaction.DoesNotExist:
                    logger.info(f"❌ No transaction found with reference: {reference}")
            
            # METHOD 3: Try to find by account number (fallback)
            if account_number and not wallet_tx:
                logger.info(f"🔍 METHOD 3: Looking for transaction with account_number: {account_number}")
                
                # Get all pending credit transactions from last 24 hours
                time_threshold = timezone.now() - timedelta(hours=24)
                
                all_txs = WalletTransaction.objects.filter(
                    created_at__gte=time_threshold,
                    tx_type=WalletTransaction.CREDIT
                ).select_for_update()
                
                # Find transactions with matching account number and pending status
                matching_txs = []
                for tx in all_txs:
                    tx_account = tx.meta.get('virtual_account', {}).get('account_number')
                    tx_status = tx.meta.get('status', '').lower()
                    
                    if tx_account and str(tx_account) == str(account_number):
                        matching_txs.append(tx)
                        logger.info(f"   Found matching TX: {tx.reference}, status={tx_status}, created={tx.created_at}")
                
                logger.info(f"   Found {len(matching_txs)} total transactions with account {account_number}")
                
                # Filter to only pending transactions
                pending_matches = [tx for tx in matching_txs if tx.meta.get('status', '').lower() == 'pending']
                logger.info(f"   Of these, {len(pending_matches)} are pending")
                
                if len(pending_matches) == 1:
                    # Exactly one pending match - perfect
                    wallet_tx = pending_matches[0]
                    matching_method = "account_number_single"
                    logger.info(f"✅ Found single pending transaction by account number: {wallet_tx.reference}")
                    
                elif len(pending_matches) > 1:
                    # Multiple pending matches - take the most recent, mark others as failed
                    logger.error(f"❌ Multiple pending transactions ({len(pending_matches)}) for same account!")
                    
                    # Sort by created_at descending (most recent first)
                    pending_matches.sort(key=lambda x: x.created_at, reverse=True)
                    
                    # Use the most recent one
                    wallet_tx = pending_matches[0]
                    logger.info(f"✅ Using most recent transaction: {wallet_tx.reference} from {wallet_tx.created_at}")
                    
                    # Mark all older ones as failed
                    for tx in pending_matches[1:]:
                        logger.info(f"🔄 Marking older transaction {tx.reference} as failed (superseded)")
                        tx.meta.update({
                            'status': 'failed',
                            'failed_reason': f'Superseded by newer transaction {wallet_tx.reference}',
                            'failed_at': str(timezone.now())
                        })
                        tx.save(update_fields=['meta'])
                    
                    matching_method = "account_number_most_recent"
            
            # METHOD 4: Try to find by amount and time window (least reliable)
            if amount and not wallet_tx:
                logger.info(f"🔍 METHOD 4: Looking for transaction by amount: {amount}")
                
                time_threshold = timezone.now() - timedelta(hours=6)  # Last 6 hours only
                webhook_amount = Decimal(str(amount))
                
                pending_txs = WalletTransaction.objects.filter(
                    created_at__gte=time_threshold,
                    tx_type=WalletTransaction.CREDIT,
                ).select_for_update()
                
                # Filter in Python
                matches = []
                for tx in pending_txs:
                    tx_status = tx.meta.get('status', '').lower()
                    if tx_status != 'pending':
                        continue
                    
                    tx_amount = tx.amount
                    amount_diff = abs(tx_amount - webhook_amount)
                    
                    # Allow small difference (within 1 naira)
                    if amount_diff < Decimal('1.00'):
                        matches.append(tx)
                        logger.info(f"   Amount match: {tx.reference} ({tx_amount} ≈ {webhook_amount})")
                
                if len(matches) == 1:
                    wallet_tx = matches[0]
                    matching_method = "amount_single"
                    logger.info(f"✅ Found single transaction by amount: {wallet_tx.reference}")
                elif len(matches) > 1:
                    logger.error(f"❌ Multiple amount matches ({len(matches)})")
                    # Sort by created_at and take most recent
                    matches.sort(key=lambda x: x.created_at, reverse=True)
                    wallet_tx = matches[0]
                    matching_method = "amount_most_recent"
                    logger.info(f"✅ Using most recent amount match: {wallet_tx.reference}")
            
            if not wallet_tx:
                logger.error("❌ COULD NOT FIND ANY MATCHING TRANSACTION")
                logger.error(f"   - Order Number: {order_number}")
                logger.error(f"   - Account Number: {account_number}")
                logger.error(f"   - Reference: {reference}")
                logger.error(f"   - Amount: {amount}")
                
                # Store unmatched webhook for manual review
                try:
                    UnmatchedWebhook.objects.create(
                        reference=reference or order_number or 'unknown',
                        amount=Decimal(str(amount)) if amount else None,
                        payload=data,
                        gateway='otpay'
                    )
                    logger.info("📝 Stored unmatched webhook in database")
                except Exception as e:
                    logger.error(f"Failed to store unmatched webhook: {str(e)}")
                
                return HttpResponse(status=200)
            
            # Check if already completed
            current_status = wallet_tx.meta.get('status', '').lower()
            if current_status == 'completed':
                logger.info(f"⏭️ Transaction {wallet_tx.reference} already completed at {wallet_tx.meta.get('completed_at')}")
                return HttpResponse(status=200)
            
            # Verify amount matches (if amount provided)
            if amount:
                webhook_amount = Decimal(str(amount))
                tx_amount = wallet_tx.amount
                amount_diff = abs(webhook_amount - tx_amount)
                
                logger.info(f"   Amount verification: webhook={webhook_amount}, tx={tx_amount}, diff={amount_diff}")
                
                # Allow small difference (1 naira or 1% whichever is larger)
                max_diff = max(Decimal('1.00'), tx_amount * Decimal('0.01'))
                
                if amount_diff > max_diff:
                    logger.error(f"❌ Amount mismatch! Webhook: {webhook_amount}, Transaction: {tx_amount}")
                    logger.error(f"   Difference {amount_diff} exceeds maximum allowed {max_diff}")
                    
                    # Store the webhook data but don't process
                    wallet_tx.meta.update({
                        'webhook_received_at': str(timezone.now()),
                        'webhook_data': data,
                        'amount_mismatch': {
                            'webhook_amount': str(webhook_amount),
                            'transaction_amount': str(tx_amount),
                            'difference': str(amount_diff)
                        }
                    })
                    wallet_tx.save(update_fields=['meta'])
                    
                    return HttpResponse(status=200)
            
            logger.info(f"✅ Found matching transaction via method: {matching_method}")
            logger.info(f"   - Transaction: {wallet_tx.reference}")
            logger.info(f"   - User ID: {wallet_tx.user_id}")
            logger.info(f"   - Amount: {wallet_tx.amount}")
            logger.info(f"   - Current status: {current_status}")
            
            # Store OTPay identifiers in meta for future reference
            if order_number:
                wallet_tx.meta['order_number'] = order_number
            if transaction_id:
                wallet_tx.meta['otpay_transaction_id'] = transaction_id
            if reference and reference != wallet_tx.reference:
                wallet_tx.meta['webhook_reference'] = reference
            
            # Credit the wallet
            wallet, created = Wallet.objects.select_for_update().get_or_create(
                user=wallet_tx.user,
                defaults={'balance': 0, 'spot_balance': 0}
            )
            logger.info(f"   - Wallet found: {wallet.id}, current balance: {wallet.balance}, spot: {wallet.spot_balance}")
            
            # Get the amount to credit (use transaction amount)
            amount_to_credit = wallet_tx.amount
            
            # Split amount equally between balance and spot_balance
            half_amount = (amount_to_credit / Decimal('2')).quantize(Decimal('0.01'))
            
            # Update wallet balance
            wallet.balance += half_amount
            wallet.spot_balance += half_amount
            wallet.save()
            logger.info(f"   - New balance: {wallet.balance}, new spot: {wallet.spot_balance}")
            
            # Check if this is first deposit
            has_previous = WalletTransaction.objects.filter(
                user=wallet_tx.user,
                tx_type=WalletTransaction.CREDIT,
                meta__status='completed'
            ).exclude(id=wallet_tx.id).exists()
            
            # Update transaction meta with status
            wallet_tx.meta.update({
                'status': 'completed',
                'verified': True,
                'gateway': 'otpay',
                'webhook_received_at': str(timezone.now()),
                'webhook_data': data,
                'completed_at': str(timezone.now()),
                'matching_method': matching_method,
                'distribution': {
                    'total': str(amount_to_credit),
                    'to_balance': str(half_amount),
                    'to_spot_balance': str(half_amount),
                }
            })
            
            wallet_tx.first_deposit = not has_previous
            wallet_tx.save(update_fields=['meta', 'first_deposit'])
            
            logger.info("=" * 50)
            logger.info(f"✅✅✅ TRANSACTION COMPLETED SUCCESSFULLY ✅✅✅")
            logger.info(f"   - Transaction: {wallet_tx.reference}")
            logger.info(f"   - User: {wallet_tx.user_id}")
            logger.info(f"   - Amount: {amount_to_credit}")
            logger.info(f"   - Split: {half_amount} to balance, {half_amount} to spot")
            logger.info(f"   - First deposit: {wallet_tx.first_deposit}")
            logger.info(f"   - Matching method: {matching_method}")
            logger.info("=" * 50)
    
    except Exception as e:
        logger.error("❌❌❌ ERROR PROCESSING WEBHOOK ❌❌❌")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error(traceback.format_exc())
        return HttpResponse(status=500)
    
    logger.info("=" * 70)
    logger.info("🏁 WEBHOOK PROCESSING COMPLETED SUCCESSFULLY")
    logger.info("=" * 70)
    
    return HttpResponse(status=200)


@csrf_exempt
@require_POST
def otpay_webhook_debug(request):
    """
    Debug endpoint to see what OTPay is sending
    URL: /api/wallet/webhook/otpay/debug/
    """
    logger.info("=" * 50)
    logger.info("🔍 OTPAY DEBUG WEBHOOK RECEIVED")
    logger.info(f"Method: {request.method}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    response_data = {
        "status": "received",
        "message": "Webhook received for debugging",
        "timestamp": str(timezone.now()),
        "headers": dict(request.headers),
    }
    
    try:
        payload = request.body.decode('utf-8')
        logger.info(f"Raw body: {payload}")
        response_data["raw_payload"] = payload
        
        # Try to parse as JSON
        try:
            data = json.loads(payload)
            logger.info(f"Parsed JSON: {json.dumps(data, indent=2)}")
            response_data["parsed_json"] = data
            
            # Extract common fields for debugging
            extracted = {
                "order_number": None,
                "account_number": None,
                "amount": None,
                "status": None,
                "reference": None,
                "transaction_id": None,
            }
            
            # Try to find order_number
            for field in ['order_number', 'order_no', 'orderId', 'order_id']:
                if field in data:
                    extracted["order_number"] = data[field]
                    break
            
            # Try to find account_number
            for field in ['account_number', 'account', 'virtual_account', 'va_number']:
                if field in data:
                    extracted["account_number"] = data[field]
                    break
            
            # Try to find amount
            for field in ['amount', 'total', 'charged_amount', 'paid_amount']:
                if field in data:
                    extracted["amount"] = data[field]
                    break
            
            # Try to find status
            for field in ['status', 'transaction_status', 'payment_status']:
                if field in data:
                    extracted["status"] = data[field]
                    break
            
            # Try to find reference
            for field in ['reference', 'ref', 'custom_ref']:
                if field in data:
                    extracted["reference"] = data[field]
                    break
            
            # Try to find transaction_id
            for field in ['transaction_id', 'txn_id', 'id']:
                if field in data:
                    extracted["transaction_id"] = data[field]
                    break
            
            response_data["extracted_fields"] = extracted
            
            # Also log to a separate file for review
            import os
            from django.conf import settings
            
            log_path = os.path.join(settings.BASE_DIR, 'otpay_webhook_debug.log')
            with open(log_path, 'a') as f:
                f.write(f"{timezone.now()}: {json.dumps(data)}\n")
                
        except json.JSONDecodeError as e:
            logger.info(f"Body is not JSON: {str(e)}")
            response_data["parse_error"] = str(e)
            response_data["body_preview"] = payload[:500]
            
    except Exception as e:
        logger.error(f"Error reading body: {str(e)}")
        response_data["error"] = str(e)
    
    logger.info("=" * 50)
    
    return JsonResponse(response_data)