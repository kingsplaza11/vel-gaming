import json
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import transaction as db_transaction
from ..models import Wallet, WalletTransaction
from ..paystack import PaystackService

@csrf_exempt
@require_POST
def paystack_webhook(request):
    """Handle Paystack webhook notifications"""
    paystack_service = PaystackService()
    
    # Get request payload
    payload = request.body
    signature = request.headers.get('X-Paystack-Signature', '')
    
    # Verify webhook signature
    if not paystack_service.verify_webhook_signature(payload, signature):
        return HttpResponse(status=400)
    
    # Parse payload
    event_data = json.loads(payload)
    event = event_data.get('event')
    data = event_data.get('data', {})
    
    if event == 'charge.success':
        reference = data.get('reference')
        
        # Verify transaction
        verification = paystack_service.verify_transaction(reference)
        
        if verification.get('status') and verification['data']['status'] == 'success':
            try:
                wallet_transaction = WalletTransaction.objects.get(
                    reference=reference,
                    meta__status='pending'
                )
            except WalletTransaction.DoesNotExist:
                return HttpResponse(status=404)
            
            # Update wallet
            with db_transaction.atomic():
                wallet, _ = Wallet.objects.get_or_create(user=wallet_transaction.user)
                wallet.balance += wallet_transaction.amount
                wallet.save()
                
                # Update transaction
                wallet_transaction.meta.update({
                    'status': 'completed',
                    'verified': True,
                    'webhook_processed': True,
                    'paystack_data': verification['data']
                })
                wallet_transaction.save()
    
    elif event == 'transfer.success':
        # Handle successful transfer (withdrawal)
        transfer_code = data.get('transfer_code')
        
        # Find withdrawal transaction
        try:
            wallet_transaction = WalletTransaction.objects.filter(
                meta__transfer_code=transfer_code,
                meta__status='processing'
            ).first()
            
            if wallet_transaction:
                with db_transaction.atomic():
                    wallet, _ = Wallet.objects.get_or_create(user=wallet_transaction.user)
                    wallet.locked_balance -= wallet_transaction.amount
                    wallet.save()
                    
                    wallet_transaction.meta['status'] = 'completed'
                    wallet_transaction.meta['webhook_processed'] = True
                    wallet_transaction.save()
        except WalletTransaction.DoesNotExist:
            pass
    
    elif event in ['transfer.failed', 'transfer.reversed']:
        # Handle failed or reversed transfer
        transfer_code = data.get('transfer_code')
        
        try:
            wallet_transaction = WalletTransaction.objects.filter(
                meta__transfer_code=transfer_code,
                meta__status='processing'
            ).first()
            
            if wallet_transaction:
                with db_transaction.atomic():
                    wallet, _ = Wallet.objects.get_or_create(user=wallet_transaction.user)
                    wallet.locked_balance -= wallet_transaction.amount
                    wallet.balance += wallet_transaction.amount  # Refund
                    wallet.save()
                    
                    wallet_transaction.meta['status'] = 'failed'
                    wallet_transaction.meta['webhook_processed'] = True
                    wallet_transaction.save()
        except WalletTransaction.DoesNotExist:
            pass
    
    return HttpResponse(status=200)