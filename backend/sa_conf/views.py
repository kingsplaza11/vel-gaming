from datetime import timedelta
from decimal import Decimal

from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.contrib import messages
from accounts.models import User, Referral
from wallets.models import Wallet, WalletTransaction

from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Count


@staff_member_required
def dashboard(request):
    today = timezone.now().date()

    context = {
        "active": "dashboard",
        "total_users": User.objects.count(),
        "total_referrals": Referral.objects.count(),
        "total_transactions": WalletTransaction.objects.count(),
        "total_volume": WalletTransaction.objects.aggregate(
            total=Sum("amount")
        )["total"] or 0,
    }

    return render(request, "sa/dashboard.html", context)


@staff_member_required
def referral_list(request):
    referrals = (
        User.objects
        .filter(referred_by__isnull=False)
        .select_related("referred_by")
        .order_by("-date_joined")
    )

    return render(request, "sa/referral_list.html", {
        "referrals": referrals
    })


@staff_member_required
def referral_detail(request, user_id):
    referred_user = get_object_or_404(User, id=user_id)
    referrer = referred_user.referred_by

    wallet = Wallet.objects.filter(user=referred_user).first()

    # Same logic as API
    now = timezone.now()
    day = now - timedelta(days=1)
    week = now - timedelta(days=7)
    month = now - timedelta(days=30)

    txs = WalletTransaction.objects.filter(
        user=referred_user,
        tx_type=WalletTransaction.CREDIT,
        meta__status="completed"
    )


    context = {
        "referrer": referrer,
        "user": referred_user,
        "wallet": wallet,
        "daily": txs.filter(created_at__gte=day).aggregate(Sum("amount"))["amount__sum"] or 0,
        "weekly": txs.filter(created_at__gte=week).aggregate(Sum("amount"))["amount__sum"] or 0,
        "monthly": txs.filter(created_at__gte=month).aggregate(Sum("amount"))["amount__sum"] or 0,
        "total": txs.aggregate(Sum("amount"))["amount__sum"] or 0,
        "transactions": txs.order_by("-created_at")[:100],
    }

    return render(request, "sa/referral_detail.html", context)


@staff_member_required
def users(request):
    users = (
        User.objects
        .select_related("wallet")
        .order_by("-date_joined")
    )

    return render(request, "sa/users.html", {
        "active": "users",
        "users": users,
    })


@staff_member_required
def update_wallet(request, user_id):
    if request.method != "POST":
        return redirect("adminpanel:admin_user_detail", user_id=user_id)

    user = get_object_or_404(User, id=user_id)
    wallet = get_object_or_404(Wallet, user=user)

    try:
        wallet.balance = Decimal(request.POST.get("balance", wallet.balance))
        wallet.spot_balance = Decimal(request.POST.get("spot_balance", wallet.spot_balance))
        wallet.locked_balance = Decimal(request.POST.get("locked_balance", wallet.locked_balance))
        wallet.save()

        messages.success(request, "Wallet updated successfully.")
    except Exception as e:
        messages.error(request, f"Wallet update failed: {e}")

    return redirect("adminpanel:admin_user_detail", user_id=user_id)


from django.contrib.auth import get_user_model

User = get_user_model()

@staff_member_required
def admin_user_detail(request, user_id):
    user = get_object_or_404(
        User.objects.select_related("referred_by"),
        id=user_id
    )

    wallet = getattr(user, "wallet", None)
    referrals = user.referrals.all()

    context = {
        "user_obj": user,
        "wallet": wallet,
        "referrals": referrals,
    }
    return render(request, "sa/user_detail.html", context)

@staff_member_required
def admin_delete_user(request, user_id):
    if request.method != "POST":
        messages.error(request, "Invalid request method.")
        return redirect("adminpanel:users")

    user = get_object_or_404(User, id=user_id)

    # 🚫 Prevent admin from deleting themselves
    if user == request.user:
        messages.error(request, "You cannot delete your own account.")
        return redirect("adminpanel:admin_user_detail", user_id=user.id)

    email = user.email
    user.delete()

    messages.success(request, f"User {email} was deleted successfully.")
    return redirect("adminpanel:users")


from django.contrib.auth import authenticate, login
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_protect


@csrf_protect
def admin_login(request):
    if request.user.is_authenticated and request.user.is_staff:
        return redirect("adminpanel:dashboard")

    error = None

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "").strip()

        user = authenticate(request, username=username, password=password)

        if user and user.is_staff:
            login(request, user)
            return redirect("adminpanel:dashboard")

        error = "Invalid credentials or insufficient permissions"

    return render(request, "sa/login.html", {
        "error": error
    })
