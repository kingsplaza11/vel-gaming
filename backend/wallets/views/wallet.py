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
from ..models import (
    Wallet, WalletTransaction, WithdrawalRequest, 
    AdminBank, DepositRequest, DepositLimit
)
from ..wallet import (
    FundWalletSerializer,
    WithdrawalSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
    DepositRequestSerializer,
)
import random
from ..paystack import PaystackService
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.db import models
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


def send_deposit_confirmation_email(user, deposit_request):
    """
    Send confirmation email to user after deposit request submission
    """
    try:
        subject = f"Deposit Request Received - Reference: {deposit_request.reference}"
        
        # Email context data
        context = {
            'user': user,
            'deposit': deposit_request,
            'amount': deposit_request.amount,
            'reference': deposit_request.reference,
            'bank_name': deposit_request.admin_bank.bank_name,
            'account_number': deposit_request.admin_bank.account_number,
            'account_name': deposit_request.admin_bank.account_name,
            'created_at': deposit_request.created_at,
            'support_email': 'support@veltrogames.com',
            'support_whatsapp': '+1 (825) 572-0351',
        }
        
        # Render HTML template
        html_content = render_to_string('emails/deposit_confirmation.html', context)
        
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
        
        logger.info(f"Deposit confirmation email sent to {user.email} for reference {deposit_request.reference}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send deposit confirmation email to {user.email}: {str(e)}")
        return False


class WalletViewSet(viewsets.GenericViewSet):
    """
    Wallet API:
    - balance
    - get-admin-banks
    - create-deposit-request
    - check-deposit-status
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
    # GET ADMIN BANKS (FOR DEPOSITS)
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def get_admin_banks(self, request):
        """Get list of active admin bank accounts for deposits"""
        banks = AdminBank.objects.filter(is_active=True)
        
        # Get user's deposit limits
        user = request.user
        user_limits = DepositLimit.objects.filter(
            models.Q(user=user) | models.Q(user__isnull=True),
            is_active=True
        )
        
        # Create limit dictionary
        limit_dict = {}
        for limit in user_limits:
            key = f"{limit.period}_{limit.admin_bank_id if limit.admin_bank else 'global'}"
            limit_dict[key] = {
                'min': float(limit.min_amount),
                'max': float(limit.max_amount) if limit.max_amount else None,
            }
        
        data = []
        for bank in banks:
            data.append({
                'id': bank.id,
                'bank_name': bank.bank_name,
                'account_number': bank.account_number,
                'account_name': bank.account_name,
                'min_deposit': float(bank.min_deposit_amount),
                'max_deposit': float(bank.max_deposit_amount) if bank.max_deposit_amount else None,
                'is_default': bank.is_default,
            })
        
        return Response({
            'status': True,
            'banks': data,
            'limits': limit_dict,
        })

    # ---------------------------------------------------
    # CREATE DEPOSIT REQUEST
    # ---------------------------------------------------

    @action(detail=False, methods=["post"])
    def create_deposit_request(self, request):
        """Create a new deposit request with random bank selection"""
        amount = request.data.get('amount')
        source_bank_name = request.data.get('source_bank_name', '')
        source_account_number = request.data.get('source_account_number', '')
        source_account_name = request.data.get('source_account_name', '')
        
        if not amount:
            return Response(
                {"status": False, "message": "Amount is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            amount = Decimal(str(amount))
        except:
            return Response(
                {"status": False, "message": "Invalid amount format"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all active banks
        active_banks = AdminBank.objects.filter(is_active=True)
        
        if not active_banks.exists():
            return Response(
                {"status": False, "message": "No active banks available for deposit. Please contact support."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        # Filter banks that can accept this amount
        suitable_banks = []
        for bank in active_banks:
            if amount >= bank.min_deposit_amount:
                if not bank.max_deposit_amount or amount <= bank.max_deposit_amount:
                    suitable_banks.append(bank)
        
        if not suitable_banks:
            # Find the bank with highest max limit or lowest min limit for better error message
            highest_max = max(active_banks, key=lambda b: b.max_deposit_amount or 0)
            lowest_min = min(active_banks, key=lambda b: b.min_deposit_amount)
            
            if amount < lowest_min.min_deposit_amount:
                return Response(
                    {"status": False, "message": f"Amount too low. Minimum deposit across all banks is ₦{lowest_min.min_deposit_amount}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            else:
                return Response(
                    {"status": False, "message": f"Amount too high for all banks. Maximum deposit available is ₦{highest_max.max_deposit_amount}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Randomly select a bank from suitable banks
        selected_bank = random.choice(suitable_banks)
        
        # Check for existing pending deposit
        pending_count = DepositRequest.objects.filter(
            user=request.user,
            status__in=['pending', 'processing']
        ).count()
        
        if pending_count >= 3:  # Allow up to 3 pending deposits
            return Response(
                {"status": False, "message": "You have too many pending deposit requests. Please wait for them to be processed."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate unique reference
        timestamp = timezone.now().strftime('%Y%m%d%H%M%S')
        unique_id = uuid.uuid4().hex[:8].upper()
        reference = f"DEP{timestamp}{unique_id}"
        
        # Create deposit request
        with db_transaction.atomic():
            deposit_request = DepositRequest.objects.create(
                user=request.user,
                amount=amount,
                admin_bank=selected_bank,
                source_bank_name=source_bank_name,
                source_account_number=source_account_number,
                source_account_name=source_account_name,
                reference=reference,
                status='pending',
                expires_at=timezone.now() + timedelta(hours=24),  # Expires in 24 hours
                meta={
                    'created_via': 'web',
                    'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                    'ip_address': request.META.get('REMOTE_ADDR', ''),
                    'bank_selection': 'random',
                    'available_banks_count': len(suitable_banks),
                    'selected_from': [b.id for b in suitable_banks]
                }
            )
            
            # Create wallet transaction with pending status
            wallet_tx = WalletTransaction.objects.create(
                user=request.user,
                amount=amount,
                tx_type=WalletTransaction.CREDIT,
                reference=f"TXN{timestamp}{uuid.uuid4().hex[:8].upper()}",
                meta={
                    'status': 'pending',
                    'deposit_request_id': deposit_request.id,
                    'deposit_reference': reference,
                    'admin_bank': {
                        'id': selected_bank.id,
                        'name': selected_bank.bank_name,
                        'account_number': selected_bank.account_number,
                        'account_name': selected_bank.account_name,
                    },
                    'created_at': str(timezone.now()),
                    'expires_at': str(deposit_request.expires_at),
                    'type': 'deposit_request',
                }
            )
            
            # Update deposit request with transaction reference
            deposit_request.transaction_reference = wallet_tx.reference
            deposit_request.save(update_fields=['transaction_reference'])
        
        # Send confirmation email
        try:
            send_deposit_confirmation_email(request.user, deposit_request)
        except Exception as e:
            logger.error(f"Failed to send deposit confirmation email: {str(e)}")
        
        return Response({
            'status': True,
            'message': 'Deposit request created successfully. Please complete your bank transfer.',
            'deposit_request': {
                'id': deposit_request.id,
                'reference': deposit_request.reference,
                'amount': float(deposit_request.amount),
                'status': deposit_request.status,
                'created_at': deposit_request.created_at,
                'expires_at': deposit_request.expires_at,
                'bank_details': {
                    'bank_name': selected_bank.bank_name,
                    'account_number': selected_bank.account_number,
                    'account_name': selected_bank.account_name,
                }
            },
            'transaction_reference': wallet_tx.reference,
        }, status=status.HTTP_201_CREATED)

    # ---------------------------------------------------
    # CHECK DEPOSIT STATUS
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def check_deposit_status(self, request):
        """Check status of a deposit request"""
        reference = request.query_params.get("reference")
        
        if not reference:
            return Response(
                {"status": False, "message": "Reference required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Try to find by deposit request reference first
            deposit_request = DepositRequest.objects.get(
                reference=reference,
                user=request.user
            )
            
            response_data = {
                'status': True,
                'deposit_request': {
                    'id': deposit_request.id,
                    'reference': deposit_request.reference,
                    'amount': float(deposit_request.amount),
                    'status': deposit_request.status,
                    'created_at': deposit_request.created_at,
                    'expires_at': deposit_request.expires_at,
                    'completed_at': deposit_request.completed_at,
                    'admin_notes': deposit_request.admin_notes,
                    'bank_details': {
                        'bank_name': deposit_request.admin_bank.bank_name,
                        'account_number': deposit_request.admin_bank.account_number,
                        'account_name': deposit_request.admin_bank.account_name,
                    }
                }
            }
            
            # Check if expired
            if deposit_request.expires_at and deposit_request.expires_at < timezone.now():
                if deposit_request.status == 'pending':
                    deposit_request.status = 'expired'
                    deposit_request.save(update_fields=['status'])
                    response_data['deposit_request']['status'] = 'expired'
            
            # Check if completed
            if deposit_request.status == 'completed':
                response_data['message'] = 'Deposit completed successfully!'
            elif deposit_request.status == 'pending':
                response_data['message'] = 'Your deposit request is pending review. Please wait for admin confirmation.'
            elif deposit_request.status == 'processing':
                response_data['message'] = 'Your deposit is being processed.'
            elif deposit_request.status == 'failed':
                response_data['message'] = 'Deposit failed. Please contact support.'
            elif deposit_request.status == 'expired':
                response_data['message'] = 'Deposit request expired. Please create a new deposit.'
            
            return Response(response_data)
            
        except DepositRequest.DoesNotExist:
            # Try to find by wallet transaction reference
            try:
                wallet_tx = WalletTransaction.objects.get(
                    reference=reference,
                    user=request.user
                )
                
                if 'deposit_request_id' in wallet_tx.meta:
                    deposit_request = DepositRequest.objects.get(
                        id=wallet_tx.meta['deposit_request_id'],
                        user=request.user
                    )
                    
                    return Response({
                        'status': True,
                        'deposit_request': {
                            'id': deposit_request.id,
                            'reference': deposit_request.reference,
                            'amount': float(deposit_request.amount),
                            'status': deposit_request.status,
                            'created_at': deposit_request.created_at,
                            'expires_at': deposit_request.expires_at,
                            'bank_details': {
                                'bank_name': deposit_request.admin_bank.bank_name,
                                'account_number': deposit_request.admin_bank.account_number,
                                'account_name': deposit_request.admin_bank.account_name,
                            }
                        }
                    })
                
                return Response({
                    'status': True,
                    'transaction': {
                        'reference': wallet_tx.reference,
                        'amount': float(wallet_tx.amount),
                        'status': wallet_tx.meta.get('status', 'unknown'),
                        'type': 'wallet_transaction',
                    }
                })
                
            except WalletTransaction.DoesNotExist:
                return Response(
                    {"status": False, "message": "Deposit request not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

    # ---------------------------------------------------
    # MARK DEPOSIT AS PAID (USER ACTION)
    # ---------------------------------------------------
    @action(detail=False, methods=["post"])
    def mark_as_paid(self, request):
        """User marks that they have made the payment"""
        deposit_request_id = request.data.get('deposit_request_id')
        reference = request.data.get('reference')
        
        if not deposit_request_id and not reference:
            return Response(
                {"status": False, "message": "Deposit request ID or reference required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if deposit_request_id:
                deposit_request = DepositRequest.objects.get(
                    id=deposit_request_id,
                    user=request.user
                )
            else:
                deposit_request = DepositRequest.objects.get(
                    reference=reference,
                    user=request.user
                )
            
            # Check if already marked as paid
            if deposit_request.status != 'pending':
                return Response({
                    'status': False,
                    'message': f'This deposit request is already {deposit_request.status}',
                    'current_status': deposit_request.status
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if expired
            if deposit_request.expires_at and deposit_request.expires_at < timezone.now():
                deposit_request.status = 'expired'
                deposit_request.save(update_fields=['status'])
                return Response({
                    'status': False,
                    'message': 'This deposit request has expired. Please create a new one.',
                    'current_status': 'expired'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Update status to processing (admin will verify)
            deposit_request.status = 'processing'
            deposit_request.meta['user_marked_as_paid_at'] = str(timezone.now())
            deposit_request.meta['user_marked_as_paid_from_ip'] = request.META.get('REMOTE_ADDR', '')
            deposit_request.save(update_fields=['status', 'meta'])
            
            # Update wallet transaction meta
            if deposit_request.transaction_reference:
                try:
                    wallet_tx = WalletTransaction.objects.get(
                        reference=deposit_request.transaction_reference
                    )
                    wallet_tx.meta['user_marked_as_paid'] = True
                    wallet_tx.meta['user_marked_as_paid_at'] = str(timezone.now())
                    wallet_tx.save(update_fields=['meta'])
                except WalletTransaction.DoesNotExist:
                    pass
            
            # Notify admin (you can add your notification logic here)
            
            return Response({
                'status': True,
                'message': 'Payment notification received. Your deposit is now pending admin verification.',
                'deposit_request': {
                    'id': deposit_request.id,
                    'reference': deposit_request.reference,
                    'status': deposit_request.status,
                    'updated_at': deposit_request.updated_at,
                }
            })
            
        except DepositRequest.DoesNotExist:
            return Response(
                {"status": False, "message": "Deposit request not found"},
                status=status.HTTP_404_NOT_FOUND
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
                status='pending',  # Changed from 'SUCCESS' to 'pending'
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
                    "status": "pending",
                    "withdrawal_reference": withdrawal_ref,
                    "withdrawal_request_id": withdrawal_request.id,
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
    
    # ---------------------------------------------------
    # GET USER DEPOSIT REQUESTS
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def deposit_requests(self, request):
        """Get user's deposit requests"""
        deposit_requests = DepositRequest.objects.filter(
            user=request.user
        ).order_by("-created_at")
        
        data = []
        for dr in deposit_requests:
            data.append({
                'id': dr.id,
                'reference': dr.reference,
                'amount': float(dr.amount),
                'status': dr.status,
                'created_at': dr.created_at,
                'expires_at': dr.expires_at,
                'completed_at': dr.completed_at,
                'bank_name': dr.admin_bank.bank_name,
                'account_number': dr.admin_bank.account_number,
                'account_name': dr.admin_bank.account_name,
            })
        
        return Response({
            'status': True,
            'deposit_requests': data
        })


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