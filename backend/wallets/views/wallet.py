import uuid
import logging
from decimal import Decimal

from django.db import transaction as db_transaction
from django.conf import settings

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
from ..paystack import PaystackService


logger = logging.getLogger(__name__)

# utils/email_service.py
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
import logging


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
    - fund (Paystack)
    - verify
    - withdraw (manual / starter-safe)
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
    # FUND WALLET (PAYSTACK INITIALIZE)
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

        reference = f"fund_{uuid.uuid4().hex[:12]}"
        paystack_amount = int(amount * 100)

        paystack = PaystackService()
        response = paystack.initialize_transaction(
            email=email,
            amount=paystack_amount,
            reference=reference,
            metadata={
                "user_id": request.user.id,
                "purpose": "wallet_funding",
            },
        )

        if not response.get("status"):
            return Response(
                {"status": False, "message": "Failed to initialize transaction"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        WalletTransaction.objects.create(
            user=request.user,
            amount=amount,
            tx_type=WalletTransaction.CREDIT,
            reference=reference,
            meta={
                "status": "pending",
                "gateway": "paystack",
                "authorization_url": response["data"]["authorization_url"],
            },
        )

        return Response(
            {
                "status": True,
                "authorization_url": response["data"]["authorization_url"],
                "reference": reference,
            }
        )

    @action(detail=False, methods=["get", "post"])
    def verify(self, request):
        reference = request.data.get("reference") or request.query_params.get("reference")

        if not reference:
            return Response({"status": False, "message": "Reference required"}, status=400)

        try:
            wallet_tx = WalletTransaction.objects.select_for_update().get(
                reference=reference,
                user=request.user,
            )
        except WalletTransaction.DoesNotExist:
            return Response({"status": False, "message": "Transaction not found"}, status=404)

        if wallet_tx.meta.get("status") == "completed":
            wallet = Wallet.objects.get(user=request.user)
            return Response(
                {
                    "status": True,
                    "balance": float(wallet.balance),
                    "spot_balance": float(wallet.spot_balance),
                    "total_balance": float(wallet.balance + wallet.spot_balance)
                }
            )

        paystack = PaystackService()
        verification = paystack.verify_transaction(reference)
        data = verification.get("data", {})

        if not verification.get("status") or data.get("status") != "success":
            wallet_tx.meta = {**wallet_tx.meta, "status": "failed"}
            wallet_tx.save()
            return Response({"status": False, "message": "Verification failed"}, status=400)

        if data.get("amount") != int(wallet_tx.amount * 100):
            wallet_tx.meta = {**wallet_tx.meta, "status": "failed", "reason": "amount_mismatch"}
            wallet_tx.save()
            return Response({"status": False, "message": "Amount mismatch"}, status=400)

        with db_transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
            
            # Split amount equally between balance and spot_balance
            total_amount = wallet_tx.amount
            half_amount = total_amount / Decimal('2')
            
            # Ensure proper decimal precision (2 decimal places for currency)
            half_amount = half_amount.quantize(Decimal('0.01'))
            
            # Add to both balances
            wallet.balance += half_amount
            wallet.spot_balance += half_amount
            
            wallet.save()

            wallet_tx.meta = {
                **wallet_tx.meta,
                "status": "completed",
                "verified": True,
                "paystack_data": data,
                "distribution": {
                    "total_funded": str(total_amount),
                    "to_balance": str(half_amount),
                    "to_spot_balance": str(half_amount)
                }
            }
            wallet_tx.save()

        return Response(
            {
                "status": True,
                "total_funded": float(total_amount),
                "balance_added": float(half_amount),
                "spot_balance_added": float(half_amount),
                "new_balance": float(wallet.balance),
                "new_spot_balance": float(wallet.spot_balance),
                "total_balance": float(wallet.balance + wallet.spot_balance)
            }
        )

    # ---------------------------------------------------
    # 🔥 RESOLVE BANK ACCOUNT (AUTO NAME)
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
    # WITHDRAW (Admin Approval System)
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

        # Send confirmation email to user (outside transaction block)
        try:
            # Add site URL to context
            site_url = settings.SITE_URL if hasattr(settings, 'SITE_URL') else 'https://veltrogames.com'
            
            # Send email
            email_sent = send_withdrawal_confirmation_email(
                user=request.user,
                withdrawal_request=withdrawal_request,
                wallet_transaction=wallet_transaction
            )
            
            if not email_sent:
                # Log email sending failure but don't fail the withdrawal
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to send withdrawal confirmation email to {request.user.email}")
                
        except Exception as e:
            # Log error but don't fail the withdrawal
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error sending withdrawal confirmation email: {str(e)}")

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
                "email_sent": True
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
        }
        for tx in qs
    ]

    return Response(data)