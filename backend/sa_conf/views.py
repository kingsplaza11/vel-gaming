from datetime import timedelta
from decimal import Decimal
from django.core.paginator import Paginator
from django.db.models import Q, Sum, Count, Prefetch
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.contrib import messages
from accounts.models import User, Referral
from wallets.models import Wallet, WalletTransaction, WithdrawalRequest
from django.views.decorators.http import require_POST
from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse


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

    # Fetch wallet
    wallet = Wallet.objects.filter(user=referred_user).first()

    # Fetch first deposit transaction
    first_deposit_tx = WalletTransaction.objects.filter(
        user=referred_user,
        first_deposit=True,
        tx_type=WalletTransaction.CREDIT
    ).first()

    # Calculate first deposit amount
    first_deposit_amount = first_deposit_tx.amount if first_deposit_tx else 0
    has_first_deposit = bool(first_deposit_tx)

    # Same logic as API for credit transactions
    now = timezone.now()
    day = now - timedelta(days=1)
    week = now - timedelta(days=7)
    month = now - timedelta(days=30)

    txs = WalletTransaction.objects.filter(
        user=referred_user,
        tx_type=WalletTransaction.CREDIT,
        meta__status="completed"
    )

    # Fetch all transactions for the table (with first deposit info)
    all_transactions = WalletTransaction.objects.filter(
        user=referred_user
    ).order_by("-created_at")[:100]

    # Calculate total balance
    total_balance = 0
    if wallet:
        total_balance = (wallet.balance or 0) + (wallet.spot_balance or 0)

    # Calculate referrer's total referral bonus
    referrer_total_bonus = WalletTransaction.objects.filter(
        user=referrer,
        tx_type=WalletTransaction.CREDIT,
        meta__has_key="referral_bonus"
    ).aggregate(Sum("amount"))["amount__sum"] or 0

    context = {
        "referrer": referrer,
        "user": referred_user,
        "wallet": wallet,
        "first_deposit_amount": first_deposit_amount,
        "has_first_deposit": has_first_deposit,
        "daily": txs.filter(created_at__gte=day).aggregate(Sum("amount"))["amount__sum"] or 0,
        "weekly": txs.filter(created_at__gte=week).aggregate(Sum("amount"))["amount__sum"] or 0,
        "total": txs.aggregate(Sum("amount"))["amount__sum"] or 0,
        "transactions": all_transactions,
        "total_balance": total_balance,
        "referrer_total_bonus": referrer_total_bonus,
        "referrer_total_referrals": User.objects.filter(referred_by=referrer).count(),
    }

    return render(request, "sa/referral_detail.html", context)


@staff_member_required
def users(request):
    users_qs = (
        User.objects
        .select_related("wallet")
        .prefetch_related(
            Prefetch(
                "wallet_txs",
                queryset=WalletTransaction.objects.filter(
                    first_deposit=True,
                    tx_type=WalletTransaction.CREDIT
                ).only("amount", "user"),
                to_attr="first_deposit_txs"
            )
        )
        .order_by("-date_joined")
    )

    users = []

    for u in users_qs:
        wallet = getattr(u, "wallet", None)

        # total balance = normal + spot
        total_balance = 0
        if wallet:
            total_balance = (wallet.balance or 0) + (wallet.spot_balance or 0)

        # first deposit
        first_deposit_amount = None
        has_first_deposit = False

        if hasattr(u, "first_deposit_txs") and u.first_deposit_txs:
            first_deposit_amount = u.first_deposit_txs[0].amount
            has_first_deposit = True

        # attach computed fields
        u.total_balance = total_balance
        u.first_deposit_amount = first_deposit_amount
        u.has_first_deposit = has_first_deposit

        users.append(u)

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
        User.objects
        .select_related("wallet", "referred_by")
        .prefetch_related(
            Prefetch(
                "wallet_txs",
                queryset=WalletTransaction.objects.filter(
                    first_deposit=True,
                    tx_type=WalletTransaction.CREDIT
                ).only("amount", "created_at"),
                to_attr="first_deposit_txs"
            )
        ),
        id=user_id
    )

    wallet = getattr(user, "wallet", None)

    total_balance = 0
    if wallet:
        total_balance = (wallet.balance or 0) + (wallet.spot_balance or 0)

    first_deposit = None
    has_first_deposit = False

    if hasattr(user, "first_deposit_txs") and user.first_deposit_txs:
        first_deposit = user.first_deposit_txs[0]
        has_first_deposit = True

    referrals = user.referrals.all()

    context = {
        "user_obj": user,
        "wallet": wallet,
        "total_balance": total_balance,
        "first_deposit": first_deposit,
        "has_first_deposit": has_first_deposit,
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


@staff_member_required
def withdrawal_list(request):
    """List all withdrawal requests"""
    # Get filter parameters
    status_filter = request.GET.get('status', '')
    search_query = request.GET.get('q', '')
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    
    # Start with all withdrawals
    withdrawals = WithdrawalRequest.objects.all().select_related('user')
    
    # Apply filters
    if status_filter:
        withdrawals = withdrawals.filter(status=status_filter)
    
    if search_query:
        withdrawals = withdrawals.filter(
            Q(user__username__icontains=search_query) |
            Q(user__email__icontains=search_query) |
            Q(account_name__icontains=search_query) |
            Q(reference__icontains=search_query) |
            Q(account_number__icontains=search_query)
        )
    
    if date_from:
        withdrawals = withdrawals.filter(created_at__gte=date_from)
    
    if date_to:
        withdrawals = withdrawals.filter(created_at__lte=date_to)
    
    # Order by creation date (newest first)
    withdrawals = withdrawals.order_by('-created_at')
    
    # Pagination
    paginator = Paginator(withdrawals, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Statistics
    stats = {
        'total_count': withdrawals.count(),
        'total_amount': withdrawals.aggregate(total=Sum('amount'))['total'] or 0,
        'total_pending': withdrawals.filter(status='pending').count(),
        'total_processing': withdrawals.filter(status='processing').count(),
        'total_completed': withdrawals.filter(status='completed').count(),
        'total_failed': withdrawals.filter(status='failed').count(),
    }
    
    context = {
        'active': 'withdrawals',
        'page_obj': page_obj,
        'stats': stats,
        'status_filter': status_filter,
        'search_query': search_query,
        'date_from': date_from,
        'date_to': date_to,
        'status_choices': WithdrawalRequest.STATUS_CHOICES,
    }
    
    return render(request, 'sa/withdrawal_list.html', context)

@staff_member_required
def withdrawal_detail(request, reference):
    """View withdrawal request details"""
    withdrawal = get_object_or_404(
        WithdrawalRequest.objects.select_related('user'),
        reference=reference
    )
    
    # Get related transactions
    transactions = WalletTransaction.objects.filter(
        user=withdrawal.user,
        meta__withdrawal_reference=reference
    ).order_by('-created_at')
    
    # Calculate net amount
    net_amount = withdrawal.amount - withdrawal.processing_fee
    
    # Get user's recent withdrawals
    recent_withdrawals = WithdrawalRequest.objects.filter(
        user=withdrawal.user
    ).exclude(pk=withdrawal.pk).order_by('-created_at')[:5]
    
    context = {
        'active': 'withdrawals',
        'withdrawal': withdrawal,
        'transactions': transactions,
        'net_amount': net_amount,
        'recent_withdrawals': recent_withdrawals,
    }
    
    return render(request, 'sa/withdrawal_detail.html', context)

@staff_member_required
@require_POST
def update_withdrawal_status(request, reference):
    """Update withdrawal request status"""
    withdrawal = get_object_or_404(WithdrawalRequest, reference=reference)
    
    data = json.loads(request.body)
    new_status = data.get('status')
    admin_notes = data.get('admin_notes', '')
    
    if new_status not in dict(WithdrawalRequest.STATUS_CHOICES):
        return JsonResponse({'success': False, 'error': 'Invalid status'})
    
    # Update withdrawal
    withdrawal.status = new_status
    if admin_notes:
        withdrawal.admin_notes = admin_notes
    withdrawal.save()
    
    # If status is completed, also update related wallet transaction
    if new_status == 'completed':
        WalletTransaction.objects.filter(
            meta__withdrawal_reference=reference
        ).update(
            meta__status='completed'
        )
        
        # Send completion email to user
        from wallet.utils.email_service import send_withdrawal_completion_email
        send_withdrawal_completion_email(withdrawal.user, withdrawal)
    
    return JsonResponse({'success': True, 'new_status': new_status})

@staff_member_required
@require_POST
def bulk_update_withdrawals(request):
    """Bulk update withdrawal statuses"""
    data = json.loads(request.body)
    withdrawal_ids = data.get('withdrawal_ids', [])
    new_status = data.get('status')
    admin_notes = data.get('admin_notes', '')
    
    if new_status not in dict(WithdrawalRequest.STATUS_CHOICES):
        return JsonResponse({'success': False, 'error': 'Invalid status'})
    
    # Update selected withdrawals
    updated_count = WithdrawalRequest.objects.filter(
        reference__in=withdrawal_ids
    ).update(
        status=new_status,
        admin_notes=admin_notes if admin_notes else None
    )
    
    return JsonResponse({
        'success': True, 
        'updated_count': updated_count,
        'new_status': new_status
    })


import json

@staff_member_required
@require_POST
def delete_withdrawal(request, reference):
    try:
        withdrawal = get_object_or_404(WithdrawalRequest, reference=reference)
        
        # Optional: Store some info before deletion for audit
        deletion_info = {
            'user': str(withdrawal.user),
            'amount': float(withdrawal.amount),
            'status': withdrawal.status,
            'deleted_by': str(request.user),
            'deleted_at': timezone.now().isoformat()
        }
        
        # Delete the withdrawal
        withdrawal.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Withdrawal #{reference} deleted successfully'
        })
        
    except WithdrawalRequest.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Withdrawal not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)