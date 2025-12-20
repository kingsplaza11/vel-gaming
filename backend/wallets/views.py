# wallet/views.py

import uuid
import requests
from decimal import Decimal

from django.conf import settings
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db import transaction

from .models import Wallet, WalletTransaction


PAYSTACK_HEADERS = {
    "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
    "Content-Type": "application/json",
}


# ================================
# WALLET DASHBOARD (REACT)
# ================================
@login_required
def wallet_dashboard(request):
    wallet, _ = Wallet.objects.get_or_create(user=request.user)

    transactions = (
        WalletTransaction.objects
        .filter(user=request.user)
        .order_by("-created_at")
        .values(
            "amount",
            "tx_type",
            "reference",
            "meta",
            "created_at",
        )
    )

    return JsonResponse({
        "wallet": {
            "balance": wallet.balance,
            "locked_balance": wallet.locked_balance,
            "demo_balance": wallet.demo_balance,
        },
        "transactions": list(transactions),
    })

@login_required
def initialize_deposit(request):
    amount = Decimal(request.POST.get("amount", "0"))

    if amount < 100:
        return JsonResponse({"error": "Minimum deposit is ₦100"}, status=400)

    reference = str(uuid.uuid4())

    response = requests.post(
        f"{settings.PAYSTACK_BASE_URL}/transaction/initialize",
        headers=PAYSTACK_HEADERS,
        json={
            "email": request.user.email,
            "amount": int(amount * 100),
            "reference": reference,
            "currency": "NGN",
        },
    ).json()

    if not response.get("status"):
        return JsonResponse({"error": "Paystack initialization failed"}, status=400)

    WalletTransaction.objects.create(
        user=request.user,
        amount=amount,
        tx_type=WalletTransaction.CREDIT,
        reference=reference,
        meta={"status": "pending", "channel": "paystack"},
    )

    return JsonResponse({
        "authorization_url": response["data"]["authorization_url"]
    })

@login_required
def verify_deposit(request):
    reference = request.GET.get("reference")

    tx = WalletTransaction.objects.filter(
        user=request.user,
        reference=reference
    ).first()

    if not tx or tx.meta.get("status") == "success":
        return JsonResponse({"status": "ignored"})

    response = requests.get(
        f"{settings.PAYSTACK_BASE_URL}/transaction/verify/{reference}",
        headers=PAYSTACK_HEADERS,
    ).json()

    if not response.get("status") or response["data"]["status"] != "success":
        return JsonResponse({"status": "failed"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)
        wallet.balance += tx.amount
        wallet.save()

        tx.meta["status"] = "success"
        tx.save()

    return JsonResponse({"status": "success"})

@login_required
def auto_withdraw(request):
    amount = Decimal(request.POST.get("amount"))
    bank_code = request.POST.get("bank_code")
    account_number = request.POST.get("account_number")

    if amount < 1000:
        return JsonResponse({"error": "Minimum withdrawal is ₦1000"}, status=400)

    with transaction.atomic():
        wallet = Wallet.objects.select_for_update().get(user=request.user)

        if wallet.balance < amount:
            return JsonResponse({"error": "Insufficient balance"}, status=400)

        # Create transfer recipient
        recipient_res = requests.post(
            f"{settings.PAYSTACK_BASE_URL}/transferrecipient",
            headers=PAYSTACK_HEADERS,
            json={
                "type": "nuban",
                "name": request.user.get_full_name() or request.user.username,
                "account_number": account_number,
                "bank_code": bank_code,
                "currency": "NGN",
            },
        ).json()

        if not recipient_res.get("status"):
            return JsonResponse({"error": "Recipient creation failed"}, status=400)

        recipient_code = recipient_res["data"]["recipient_code"]
        reference = str(uuid.uuid4())

        transfer_res = requests.post(
            f"{settings.PAYSTACK_BASE_URL}/transfer",
            headers=PAYSTACK_HEADERS,
            json={
                "source": "balance",
                "amount": int(amount * 100),
                "recipient": recipient_code,
                "reference": reference,
            },
        ).json()

        if not transfer_res.get("status"):
            return JsonResponse({"error": "Transfer failed"}, status=400)

        wallet.balance -= amount
        wallet.save()

        WalletTransaction.objects.create(
            user=request.user,
            amount=amount,
            tx_type=WalletTransaction.DEBIT,
            reference=reference,
            meta={
                "status": "processing",
                "recipient_code": recipient_code,
                "bank_code": bank_code,
                "account_number": account_number,
            },
        )

    return JsonResponse({"status": "processing"})

@login_required
def resolve_account(request):
    account_number = request.GET.get("account_number")
    bank_code = request.GET.get("bank_code")

    res = requests.get(
        "https://api.paystack.co/bank/resolve",
        headers=PAYSTACK_HEADERS,
        params={
            "account_number": account_number,
            "bank_code": bank_code,
        },
    ).json()

    if res.get("status"):
        return JsonResponse({
            "account_name": res["data"]["account_name"]
        })

    return JsonResponse({"error": "Unable to resolve account"}, status=400)
