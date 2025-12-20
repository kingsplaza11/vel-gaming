import uuid
import logging
from decimal import Decimal

from django.db import transaction as db_transaction
from django.conf import settings

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication, TokenAuthentication

from ..models import Wallet, WalletTransaction
from ..wallet import (
    FundWalletSerializer,
    WithdrawalSerializer,
    WalletSerializer,
    WalletTransactionSerializer,
)
from ..paystack import PaystackService


logger = logging.getLogger(__name__)


class WalletViewSet(viewsets.GenericViewSet):
    """
    Wallet API:
    - balance
    - fund (Paystack)
    - verify
    - withdraw (Paystack transfer)
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
        logger.info("WALLET FUND REQUEST RECEIVED")
        logger.info("REQUEST DATA: %s", request.data)

        serializer = FundWalletSerializer(data=request.data)

        if not serializer.is_valid():
            logger.error("FUND SERIALIZER ERROR: %s", serializer.errors)
            return Response(
                {
                    "status": False,
                    "message": "Invalid request data",
                    "errors": serializer.errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = serializer.validated_data["amount"]
        email = serializer.validated_data.get("email") or request.user.email
        metadata = request.data.get("metadata", {})

        if amount < Decimal("100.00"):
            return Response(
                {"status": False, "message": "Minimum deposit is ₦100"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reference = f"fund_{uuid.uuid4().hex[:12]}"
        paystack_amount = int(amount * 100)  # NAIRA → KOBO

        logger.info("INITIALIZING PAYSTACK TX")
        logger.info("EMAIL=%s AMOUNT=%s KOBO=%s REF=%s", email, amount, paystack_amount, reference)

        paystack = PaystackService()

        response = paystack.initialize_transaction(
            email=email,
            amount=paystack_amount,
            reference=reference,
            metadata={
                "user_id": request.user.id,
                "purpose": "wallet_funding",
                **metadata,
            },
        )

        logger.info("PAYSTACK RESPONSE: %s", response)

        if not response.get("status"):
            logger.error("PAYSTACK INIT FAILED: %s", response)
            return Response(
                {
                    "status": False,
                    "message": "Failed to initialize transaction",
                    "gateway_response": response,
                },
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
                "access_code": response["data"]["access_code"],
            },
        )

        return Response(
            {
                "status": True,
                "message": "Transaction initialized",
                "data": {
                    "authorization_url": response["data"]["authorization_url"],
                    "reference": reference,
                    "access_code": response["data"]["access_code"],
                },
            }
        )

    # ---------------------------------------------------
    # VERIFY FUNDING
    # ---------------------------------------------------
    @action(detail=False, methods=["post"])
    def verify(self, request):
        reference = request.data.get("reference")

        logger.info("VERIFY REQUEST: %s", reference)

        if not reference:
            return Response(
                {"error": "Reference is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            wallet_tx = WalletTransaction.objects.get(
                reference=reference,
                user=request.user,
            )
        except WalletTransaction.DoesNotExist:
            logger.error("TX NOT FOUND: %s", reference)
            return Response(
                {"error": "Transaction not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if wallet_tx.meta.get("status") == "completed":
            return Response(
                {
                    "status": True,
                    "message": "Already verified",
                    "data": {"balance": Wallet.objects.get(user=request.user).balance},
                }
            )

        paystack = PaystackService()
        verification = paystack.verify_transaction(reference)

        logger.info("PAYSTACK VERIFY RESPONSE: %s", verification)

        if verification.get("status") and verification["data"]["status"] == "success":
            with db_transaction.atomic():
                wallet, _ = Wallet.objects.select_for_update().get_or_create(
                    user=request.user
                )
                wallet.balance += wallet_tx.amount
                wallet.save()

                wallet_tx.meta.update(
                    {
                        "status": "completed",
                        "verified": True,
                        "paystack_data": verification["data"],
                    }
                )
                wallet_tx.save()

            return Response(
                {
                    "status": True,
                    "message": "Wallet funded successfully",
                    "data": {
                        "amount": wallet_tx.amount,
                        "new_balance": wallet.balance,
                    },
                }
            )

        return Response(
            {
                "status": False,
                "message": "Transaction verification failed",
                "gateway_response": verification,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ---------------------------------------------------
    # WITHDRAW
    # ---------------------------------------------------
    @action(detail=False, methods=["post"])
    def withdraw(self, request):
        serializer = WithdrawalSerializer(data=request.data)

        if not serializer.is_valid():
            logger.error("WITHDRAW SERIALIZER ERROR: %s", serializer.errors)
            return Response(
                {"status": False, "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = serializer.validated_data["amount"]
        account_number = serializer.validated_data["account_number"]
        bank_code = serializer.validated_data["bank_code"]
        bank_name = serializer.validated_data["bank_name"]
        account_name = serializer.validated_data["account_name"]

        wallet = Wallet.objects.select_for_update().get(user=request.user)

        if wallet.balance < amount:
            return Response(
                {"status": False, "message": "Insufficient balance"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reference = f"withdraw_{uuid.uuid4().hex[:12]}"

        with db_transaction.atomic():
            wallet.balance -= amount
            wallet.locked_balance += amount
            wallet.save()

            tx = WalletTransaction.objects.create(
                user=request.user,
                amount=amount,
                tx_type=WalletTransaction.DEBIT,
                reference=reference,
                meta={
                    "status": "processing",
                    "bank_code": bank_code,
                    "bank_name": bank_name,
                    "account_number": account_number,
                    "account_name": account_name,
                },
            )

        paystack = PaystackService()

        recipient = paystack.create_transfer_recipient(
            name=account_name,
            account_number=account_number,
            bank_code=bank_code,
        )

        if not recipient.get("status"):
            logger.error("RECIPIENT FAILED: %s", recipient)
            return Response(
                {"status": False, "message": "Recipient creation failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        transfer = paystack.initiate_transfer(
            amount=int(amount * 100),
            recipient_code=recipient["data"]["recipient_code"],
            reason=f"Wallet withdrawal for {request.user.email}",
        )

        if not transfer.get("status"):
            logger.error("TRANSFER FAILED: %s", transfer)
            return Response(
                {"status": False, "message": "Transfer failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tx.meta.update(
            {
                "transfer_code": transfer["data"]["transfer_code"],
                "recipient_code": recipient["data"]["recipient_code"],
            }
        )
        tx.save()

        return Response(
            {
                "status": True,
                "message": "Withdrawal initiated",
                "reference": reference,
            }
        )

    # ---------------------------------------------------
    # TRANSACTIONS
    # ---------------------------------------------------
    @action(detail=False, methods=["get"])
    def transactions(self, request):
        txs = WalletTransaction.objects.filter(user=request.user).order_by(
            "-created_at"
        )
        serializer = WalletTransactionSerializer(txs, many=True)
        return Response(serializer.data)
