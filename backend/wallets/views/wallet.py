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

    # ---------------------------------------------------
    # VERIFY FUNDING
    # ---------------------------------------------------
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
                {"status": True, "balance": wallet.balance}
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
            wallet.balance += wallet_tx.amount
            wallet.save()

            wallet_tx.meta = {
                **wallet_tx.meta,
                "status": "completed",
                "verified": True,
                "paystack_data": data,
            }
            wallet_tx.save()

        return Response(
            {
                "status": True,
                "amount": wallet_tx.amount,
                "new_balance": wallet.balance,
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
    # WITHDRAW (STARTER-SAFE)
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

        with db_transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=request.user)

            if wallet.spot_balance < amount:
                return Response(
                    {"status": False, "message": "Insufficient balance in Spot Balance"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            reference = f"withdraw_{uuid.uuid4().hex[:12]}"

            wallet.spot_balance -= amount
            wallet.locked_balance += amount
            wallet.save()

            WalletTransaction.objects.create(
                user=request.user,
                amount=amount,
                tx_type=WalletTransaction.DEBIT,
                reference=reference,
                meta={
                    "status": "pending_admin",
                    "bank_code": bank_code,
                    "bank_name": bank_name,
                    "account_number": account_number,
                    "account_name": account_name,
                },
            )

        return Response(
            {
                "status": True,
                "message": "Withdrawal request submitted. Processing may take up to 24 hours.",
                "reference": reference,
            }
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