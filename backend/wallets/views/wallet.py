# wallets/views.py
import uuid
import logging
from decimal import Decimal
import json
from django.db import transaction as db_transaction
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from ..models import Wallet, WalletTransaction, WithdrawalRequest
from ..wallet import (
    FundWalletSerializer,
    WithdrawalSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
)
import random
from ..paystack import PaystackService
from ..otpay_service import OTPayService
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

# utils/email_service.py
def send_withdrawal_confirmation_email(user, withdrawal_request, wallet_transaction):
    """
    Send confirmation email to user after withdrawal request submission
    """
    try:
        subject = f"Withdrawal Request Submitted - Reference: {withdrawal_request.reference}"
        
        # Email context data
        context = {
            'user': user,
            'withdrawal': withdrawal_request,
            'transaction': wallet_transaction,
            'amount': withdrawal_request.amount,
            'processing_fee': withdrawal_request.processing_fee,
            'net_amount': withdrawal_request.amount - withdrawal_request.processing_fee,
            'reference': withdrawal_request.reference,
            'account_name': withdrawal_request.account_name,
            'bank_name': withdrawal_request.bank_name,
            'account_number': withdrawal_request.account_number,
            'estimated_time': '24-48 hours',
            'support_email': 'support@veltrogames.com',
            'support_whatsapp': '+1 (825) 572-0351',
        }
        
        # Render HTML template
        html_content = render_to_string('emails/withdrawal_confirmation.html', context)
        
        # Create plain text version
        text_content = strip_tags(html_content)
        
        # Create email
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
            reply_to=[settings.DEFAULT_REPLY_TO_EMAIL]
        )
        
        # Attach HTML content
        email.attach_alternative(html_content, "text/html")
        
        # Send email
        email.send(fail_silently=False)
        
        logger.info(f"Withdrawal confirmation email sent to {user.email} for reference {withdrawal_request.reference}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send withdrawal confirmation email to {user.email}: {str(e)}")
        return False


class WalletViewSet(viewsets.GenericViewSet):
    """
    Wallet API:
    - balance
    - fund (OTPay)
    - check-payment-status
    - check-pending
    - expire-pending
    - withdraw
    - resolve-account
    - transactions
    """

    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = WalletSerializer

    def get_queryset(self):
        return Wallet.objects.filter(user=self.request.user)

    # ---------------------------------------------------
    # BALANCE
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def balance(self, request):
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        return Response(self.get_serializer(wallet).data)

    # ---------------------------------------------------
    # CHECK PENDING TRANSACTIONS
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def check_pending(self, request):
        """Check if user has any pending deposits"""
        # Auto-expire old pending transactions (older than 30 minutes)
        time_threshold = timezone.now() - timedelta(minutes=30)
        
        expired_pending = WalletTransaction.objects.filter(
            user=request.user,
            tx_type=WalletTransaction.CREDIT,
            meta__status='pending',
            created_at__lt=time_threshold
        )
        
        for tx in expired_pending:
            tx.meta['status'] = 'expired'
            tx.meta['expired_at'] = str(timezone.now())
            tx.meta['expired_reason'] = 'Auto-expired after 30 minutes'
            tx.save(update_fields=['meta'])
            logger.info(f"Auto-expired old pending transaction: {tx.reference}")
        
        # Check for active pending transactions
        pending_txs = WalletTransaction.objects.filter(
            user=request.user,
            tx_type=WalletTransaction.CREDIT,
            meta__status='pending'
        ).order_by('-created_at')
        
        if pending_txs.exists():
            tx = pending_txs.first()
            return Response({
                'has_pending': True,
                'pending_reference': tx.reference,
                'pending_amount': str(tx.amount),
                'pending_count': pending_txs.count(),
                'created_at': tx.created_at,
                'expires_at': tx.meta.get('expires_at', str(tx.created_at + timedelta(minutes=30)))
            })
        
        return Response({'has_pending': False})

    # ---------------------------------------------------
    # EXPIRE PENDING TRANSACTION
    # ---------------------------------------------------
    @action(detail=False, methods=["post"])
    def expire_pending(self, request):
        """Expire a pending transaction (user cancels)"""
        reference = request.data.get('reference')
        
        if not reference:
            return Response(
                {"status": False, "message": "Reference required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            tx = WalletTransaction.objects.get(
                reference=reference,
                user=request.user,
                tx_type=WalletTransaction.CREDIT
            )
            
            if tx.meta.get('status') != 'pending':
                return Response(
                    {"status": False, "message": "Transaction is not pending"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            tx.meta['status'] = 'expired'
            tx.meta['expired_at'] = str(timezone.now())
            tx.meta['expired_reason'] = 'User cancelled'
            tx.save(update_fields=['meta'])
            
            return Response({
                "status": True, 
                "message": "Transaction expired successfully"
            })
            
        except WalletTransaction.DoesNotExist:
            return Response(
                {"status": False, "message": "Transaction not found"},
                status=status.HTTP_404_NOT_FOUND
            )

    # ---------------------------------------------------
    # FUND WALLET (OTPAY INITIALIZE)
    # ---------------------------------------------------
    @action(detail=False, methods=["post"])
    def fund(self, request):
        serializer = FundWalletSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        email = serializer.validated_data.get("email") or request.user.email

        if amount < Decimal("100.00"):
            return Response(
                {"status": False, "message": "Minimum deposit is ₦100"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check for existing PENDING transactions
        time_threshold = timezone.now() - timedelta(minutes=30)
        
        expired_pending = WalletTransaction.objects.filter(
            user=request.user,
            tx_type=WalletTransaction.CREDIT,
            meta__status='pending',
            created_at__lt=time_threshold
        )
        
        for tx in expired_pending:
            tx.meta['status'] = 'expired'
            tx.meta['expired_at'] = str(timezone.now())
            tx.meta['expired_reason'] = 'Auto-expired before new deposit'
            tx.save(update_fields=['meta'])
        
        pending_count = WalletTransaction.objects.filter(
            user=request.user,
            tx_type=WalletTransaction.CREDIT,
            meta__status='pending'
        ).count()
        
        if pending_count > 0:
            pending_tx = WalletTransaction.objects.filter(
                user=request.user,
                tx_type=WalletTransaction.CREDIT,
                meta__status='pending'
            ).first()
            
            return Response(
                {
                    "status": False, 
                    "message": f"You already have a pending deposit of ₦{pending_tx.amount}. Please complete or wait for it to expire before making another deposit.",
                    "pending_reference": pending_tx.reference,
                    "pending_amount": str(pending_tx.amount)
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get user details
        user = request.user
        phone = getattr(user, 'phone', '') or '08000000000'
        full_name = f"{user.first_name} {user.last_name}".strip() or user.username

        # Generate unique references
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        unique_id = uuid.uuid4().hex[:16].upper()
        transaction_ref = f"TXN_{timestamp}_{unique_id}"
        account_ref = f"VA_{timestamp}_{uuid.uuid4().hex[:8].upper()}"

        try:
            # Initialize OTPay service
            otpay = OTPayService()
            
            # Try up to 3 times with increasingly unique parameters
            max_attempts = 3
            new_account = None
            otpay_response = None
            accounts_tried = []
            
            for attempt in range(max_attempts):
                # Make each attempt more unique
                attempt_suffix = f"ATT{attempt+1}_{uuid.uuid4().hex[:6]}"
                attempt_ref = f"{transaction_ref}_{attempt_suffix}"
                
                logger.info(f"=== ATTEMPT {attempt+1} of {max_attempts} ===")
                logger.info(f"Attempt reference: {attempt_ref}")
                
                # Create virtual account with attempt-specific parameters
                response = otpay.create_virtual_account(
                    phone=phone,
                    email=email,
                    name=full_name,
                    transaction_reference=attempt_ref
                )

                if response.get("status", False) or response.get("data", {}).get("accounts"):
                    data = response.get("data", {})
                    accounts = data.get("accounts", [])
                    
                    if accounts:
                        account = accounts[0]
                        account_number = account.get("number")
                        
                        # Track this account
                        accounts_tried.append({
                            "attempt": attempt + 1,
                            "account_number": account_number,
                            "bank": account.get("bank")
                        })
                        
                        # STRICT VERIFICATION: Check if this account number has been used in ANY transaction
                        existing_account = WalletTransaction.objects.filter(
                            meta__virtual_account__account_number=account_number
                        ).exists()
                        
                        # Also check if it's been used in pending or completed transactions
                        used_in_pending = WalletTransaction.objects.filter(
                            meta__virtual_account__account_number=account_number,
                            meta__status='pending'
                        ).exists()
                        
                        used_in_completed = WalletTransaction.objects.filter(
                            meta__virtual_account__account_number=account_number,
                            meta__status='completed'
                        ).exists()
                        
                        logger.info(f"Attempt {attempt+1} returned account: {account_number}")
                        logger.info(f"  - Used before: {existing_account}")
                        logger.info(f"  - Used in pending: {used_in_pending}")
                        logger.info(f"  - Used in completed: {used_in_completed}")
                        
                        if not existing_account and not used_in_pending and not used_in_completed:
                            # This is a truly brand new account
                            new_account = account
                            otpay_response = response
                            logger.info(f"✅ SUCCESS: Found NEW account on attempt {attempt+1}")
                            break
                        else:
                            logger.warning(f"❌ Account {account_number} already exists in system. Retrying...")
                    else:
                        logger.warning(f"Attempt {attempt+1} returned no accounts")
                else:
                    logger.warning(f"Attempt {attempt+1} failed: {response.get('message')}")
            
            # If we still don't have a new account after all attempts
            if not new_account:
                logger.error("All attempts failed to create a new unique account")
                logger.error(f"Accounts tried: {accounts_tried}")
                
                return Response(
                    {
                        "status": False,
                        "message": "Unable to create a new virtual account. All generated accounts already exist in our system. Please try again in a few minutes.",
                        "debug": {
                            "attempts": max_attempts,
                            "accounts_tried": accounts_tried
                        }
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Create transaction record with the verified NEW account
            wallet_tx = WalletTransaction.objects.create(
                user=request.user,
                amount=amount,
                tx_type=WalletTransaction.CREDIT,
                reference=account_ref,
                meta={
                    "status": "pending",
                    "gateway": "otpay",
                    "transaction_reference": transaction_ref,
                    "successful_attempt": attempt + 1,
                    "total_attempts": max_attempts,
                    "accounts_tried": accounts_tried,
                    "virtual_account": {
                        "account_number": new_account.get("number"),
                        "account_name": new_account.get("name"),
                        "bank_name": new_account.get("bank"),
                        "bank_code": new_account.get("bank_code", "100033"),
                        "reference": new_account.get("ref"),
                    },
                    "otpay_response": otpay_response.get("data", {}),
                    "created_at": str(timezone.now()),
                    "expires_at": str(timezone.now() + timedelta(minutes=30)),
                    "bank_used": "Palmpay",
                    "is_new_account": True,
                    "account_verified_new": True,
                    "account_created_at": str(timezone.now())
                },
            )

            return Response(
                {
                    "status": True,
                    "message": f"New virtual account created successfully with Palmpay (created on attempt {attempt+1})",
                    "reference": account_ref,
                    "transaction_reference": transaction_ref,
                    "virtual_account": {
                        "account_number": new_account.get("number"),
                        "account_name": new_account.get("name"),
                        "bank_name": new_account.get("bank"),
                    },
                    "amount": str(amount),
                    "note": "This is a brand new account created specifically for this transaction. Please make payment to this account only.",
                    "expires_at": str(timezone.now() + timedelta(minutes=30)),
                    "attempts": {
                        "successful": attempt + 1,
                        "total": max_attempts,
                        "accounts_tried": accounts_tried
                    }
                },
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error(f"Error in fund endpoint: {str(e)}", exc_info=True)
            return Response(
                {"status": False, "message": f"An error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    # ---------------------------------------------------
    # CHECK PAYMENT STATUS
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def check_payment_status(self, request):
        """Check if a payment has been received for a reference"""
        reference = request.query_params.get("reference")
        
        if not reference:
            return Response(
                {"status": False, "message": "Reference required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            wallet_tx = WalletTransaction.objects.get(
                reference=reference,
                user=request.user
            )
        except WalletTransaction.DoesNotExist:
            return Response(
                {"status": False, "message": "Transaction not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Get transaction status from meta
        tx_status = wallet_tx.meta.get("status", "pending")
        
        status_map = {
            "pending": "PENDING",
            "completed": "COMPLETED",
            "failed": "FAILED",
            "expired": "EXPIRED"
        }
        
        response_data = {
            "status": tx_status == "completed",
            "transaction_status": status_map.get(tx_status, "PENDING"),
            "reference": reference,
            "amount": str(wallet_tx.amount),
            "meta": {
                "status": tx_status,
                "completed_at": wallet_tx.meta.get("completed_at"),
                "created_at": wallet_tx.meta.get("created_at"),
                "expires_at": wallet_tx.meta.get("expires_at")
            }
        }
        
        if tx_status == "completed":
            wallet = Wallet.objects.get(user=request.user)
            response_data.update({
                "new_balance": float(wallet.balance),
                "new_spot_balance": float(wallet.spot_balance),
                "total_balance": float(wallet.balance + wallet.spot_balance),
                "first_deposit": wallet_tx.first_deposit
            })
        
        # Add OTPay reference if available
        otpay_ref = wallet_tx.meta.get('otpay_reference')
        if otpay_ref:
            response_data['otpay_reference'] = otpay_ref
        
        # Add order number if available
        order_number = wallet_tx.meta.get('order_number')
        if order_number:
            response_data['order_number'] = order_number
        
        return Response(response_data)

    # ---------------------------------------------------
    # VERIFY PAYMENT (MANUAL)
    # ---------------------------------------------------
    @action(detail=False, methods=["get", "post"])
    def verify(self, request):
        reference = request.data.get("reference") or request.query_params.get("reference")

        if not reference:
            return Response(
                {"status": False, "message": "Reference required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            wallet_tx = WalletTransaction.objects.select_for_update().get(
                reference=reference,
                user=request.user,
            )
        except WalletTransaction.DoesNotExist:
            return Response(
                {"status": False, "message": "Transaction not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if already completed
        if wallet_tx.meta.get("status") == "completed":
            wallet = Wallet.objects.get(user=request.user)
            return Response(
                {
                    "status": True,
                    "balance": float(wallet.balance),
                    "spot_balance": float(wallet.spot_balance),
                    "total_balance": float(wallet.balance + wallet.spot_balance),
                    "already_completed": True,
                    "first_deposit": wallet_tx.first_deposit
                }
            )

        # Check if expired
        if wallet_tx.meta.get("status") == "expired":
            return Response(
                {"status": False, "message": "This transaction has expired"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get OTPay reference or order number
        otpay_ref = wallet_tx.meta.get('otpay_reference')
        order_number = wallet_tx.meta.get('order_number')
        account_number = wallet_tx.meta.get('virtual_account', {}).get('account_number')
        
        # Initialize OTPay service
        otpay = OTPayService()
        
        # Try to query transaction
        verification = None
        
        # Try with order number first (most reliable)
        if order_number:
            verification = otpay.get_transaction_by_order(order_number)
        
        # Try with OTPay reference
        if not verification or not verification.get("status"):
            if otpay_ref:
                verification = otpay.query_transaction(reference=otpay_ref)
        
        # Try with account number and amount
        if not verification or not verification.get("status"):
            if account_number:
                verification = otpay.query_transaction(
                    account_number=account_number,
                    amount=int(wallet_tx.amount)
                )
        
        if not verification or not verification.get("status"):
            wallet_tx.meta.update({
                "status": "failed", 
                "verification_error": verification.get("message") if verification else "No verification method succeeded"
            })
            wallet_tx.save(update_fields=["meta"])
            return Response(
                {"status": False, "message": "Verification failed"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        data = verification.get("data", {})
        
        # Check payment status - adjust based on OTPay's response format
        payment_status = data.get("status", "").lower()
        if payment_status not in ["success", "completed", "paid"]:
            wallet_tx.meta.update({
                "status": "failed", 
                "otpay_status": payment_status,
                "otpay_data": data
            })
            wallet_tx.save(update_fields=["meta"])
            return Response(
                {"status": False, "message": f"Payment {payment_status}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify amount matches (allow small difference)
        paid_amount = Decimal(str(data.get("amount", 0))) / 100  # Convert from kobo if needed
        if abs(paid_amount - wallet_tx.amount) > Decimal('1.00'):
            wallet_tx.meta.update({
                "status": "failed", 
                "reason": "amount_mismatch",
                "expected_amount": str(wallet_tx.amount),
                "paid_amount": str(paid_amount),
                "otpay_data": data
            })
            wallet_tx.save(update_fields=["meta"])
            return Response(
                {"status": False, "message": "Amount mismatch"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process successful payment
        with db_transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
            
            # Split amount equally between balance and spot_balance
            total_amount = wallet_tx.amount
            half_amount = (total_amount / Decimal('2')).quantize(Decimal('0.01'))
            
            # Check if this is the first deposit
            has_previous_successful_deposit = WalletTransaction.objects.filter(
                user=request.user,
                tx_type=WalletTransaction.CREDIT,
                meta__status="completed"
            ).exclude(id=wallet_tx.id).exists()
            
            wallet_tx.first_deposit = not has_previous_successful_deposit
            
            # Add to both balances
            wallet.balance += half_amount
            wallet.spot_balance += half_amount
            wallet.save()

            # Update transaction record
            wallet_tx.meta.update({
                "status": "completed",
                "verified": True,
                "gateway": "otpay",
                "otpay_data": data,
                "completed_at": str(timezone.now()),
                "distribution": {
                    "total_funded": str(total_amount),
                    "to_balance": str(half_amount),
                    "to_spot_balance": str(half_amount)
                }
            })
            wallet_tx.save()

        return Response(
            {
                "status": True,
                "total_funded": float(total_amount),
                "balance_added": float(half_amount),
                "spot_balance_added": float(half_amount),
                "new_balance": float(wallet.balance),
                "new_spot_balance": float(wallet.spot_balance),
                "total_balance": float(wallet.balance + wallet.spot_balance),
                "first_deposit": wallet_tx.first_deposit
            }
        )

    # ---------------------------------------------------
    # RESOLVE BANK ACCOUNT
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def resolve_account(self, request):
        bank_code = request.query_params.get("bank_code")
        account_number = request.query_params.get("account_number")

        if not bank_code or not account_number:
            return Response(
                {"status": False, "message": "Bank code and account number required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(account_number) != 10:
            return Response(
                {"status": False, "message": "Account number must be 10 digits"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        paystack = PaystackService()
        response = paystack.resolve_account_number(
            account_number=account_number,
            bank_code=bank_code,
        )

        if not response.get("status"):
            return Response(
                {"status": False, "message": "Unable to resolve account"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "status": True,
                "account_name": response["data"]["account_name"],
            }
        )

    # ---------------------------------------------------
    # WITHDRAW
    # ---------------------------------------------------
    @action(detail=False, methods=["post"])
    def withdraw(self, request):
        serializer = WithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        amount = serializer.validated_data["amount"]
        account_number = serializer.validated_data["account_number"]
        bank_code = serializer.validated_data["bank_code"]
        bank_name = serializer.validated_data["bank_name"]
        account_name = serializer.validated_data["account_name"]
        
        # Calculate processing fee and net amount
        processing_fee = Decimal('50.00')
        net_amount = amount - processing_fee

        with db_transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)

            # Check if user has sufficient spot balance
            if wallet.spot_balance < amount:
                return Response(
                    {
                        "status": False, 
                        "message": f"Insufficient Bet Out balance. You have ₦{wallet.spot_balance}, need ₦{amount}"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Generate unique references
            withdrawal_ref = f"WTH{uuid.uuid4().hex[:8].upper()}"
            transaction_ref = f"WTX{uuid.uuid4().hex[:8].upper()}"

            # 1. Create withdrawal request
            withdrawal_request = WithdrawalRequest.objects.create(
                user=request.user,
                amount=amount,
                account_number=account_number,
                bank_code=bank_code,
                bank_name=bank_name,
                account_name=account_name,
                reference=withdrawal_ref,
                status='SUCCESS',
                processing_fee=processing_fee,
                meta={
                    "net_amount": str(net_amount),
                    "user_email": request.user.email,
                    "user_phone": getattr(request.user, 'phone', ''),
                }
            )

            # 2. Deduct from spot balance
            wallet.spot_balance -= amount
            wallet.save()

            # 3. Create wallet transaction record
            wallet_transaction = WalletTransaction.objects.create(
                user=request.user,
                amount=amount,
                tx_type=WalletTransaction.DEBIT,
                reference=transaction_ref,
                meta={
                    "status": "pending_withdrawal",
                    "withdrawal_reference": withdrawal_ref,
                    "bank_code": bank_code,
                    "bank_name": bank_name,
                    "account_number": account_number,
                    "account_name": account_name,
                    "processing_fee": str(processing_fee),
                    "net_amount": str(net_amount),
                },
            )

        # Send confirmation email to user
        try:
            email_sent = send_withdrawal_confirmation_email(
                user=request.user,
                withdrawal_request=withdrawal_request,
                wallet_transaction=wallet_transaction
            )
        except Exception as e:
            logger.error(f"Error sending withdrawal confirmation email: {str(e)}")
            email_sent = False

        return Response(
            {
                "status": True,
                "message": "Withdrawal request submitted successfully! A confirmation email has been sent to your email address.",
                "withdrawal_reference": withdrawal_ref,
                "transaction_reference": transaction_ref,
                "amount": str(amount),
                "processing_fee": str(processing_fee),
                "net_amount": str(net_amount),
                "new_spot_balance": str(wallet.spot_balance),
                "estimated_time": "24-48 hours (business days)",
                "note": "Your withdrawal is pending admin approval. Please allow 24-48 hours for funds to reflect in your bank account.",
                "email_sent": email_sent
            },
            status=status.HTTP_201_CREATED
        )

    # ---------------------------------------------------
    # TRANSACTIONS
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def transactions(self, request):
        txs = WalletTransaction.objects.filter(user=request.user).order_by("-created_at")
        serializer = WalletTransactionSerializer(txs, many=True)
        return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def wallet_transactions(request):
    qs = WalletTransaction.objects.filter(user=request.user).order_by("-created_at")

    data = [
        {
            "id": tx.id,
            "amount": str(tx.amount),
            "tx_type": tx.tx_type,
            "reference": tx.reference,
            "meta": tx.meta,
            "created_at": tx.created_at,
            "first_deposit": tx.first_deposit
        }
        for tx in qs
    ]

    return Response(data)