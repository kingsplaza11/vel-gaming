from datetime import timedelta
from decimal import Decimal
import json
from django.core.paginator import Paginator
from django.db.models import Q, Sum, Count, Prefetch
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Sum
from django.shortcuts import get_object_or_404, render, redirect
from django.utils import timezone
from django.contrib import messages
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.db import transaction as db_transaction

from accounts.models import User, Referral
from wallets.models import (
    Wallet, WalletTransaction, WithdrawalRequest, 
    AdminBank, DepositRequest, DepositLimit
)
from wallets.utils.email_service import send_deposit_confirmation_email, send_withdrawal_completion_email


# ============= ADMIN BANK MANAGEMENT =============

@staff_member_required
def bank_list(request):
    """List all admin bank accounts"""
    banks = AdminBank.objects.all().order_by('-is_default', 'bank_name')
    
    context = {
        'active': 'banks',
        'banks': banks,
    }
    return render(request, 'sa/bank_list.html', context)


@staff_member_required
def bank_create(request):
    """Create a new admin bank account"""
    if request.method == 'POST':
        try:
            bank = AdminBank.objects.create(
                bank_name=request.POST.get('bank_name'),
                account_number=request.POST.get('account_number'),
                account_name=request.POST.get('account_name'),
                branch=request.POST.get('branch', ''),
                swift_code=request.POST.get('swift_code', ''),
                routing_number=request.POST.get('routing_number', ''),
                min_deposit_amount=Decimal(request.POST.get('min_deposit_amount', '100')),
                max_deposit_amount=Decimal(request.POST.get('max_deposit_amount')) if request.POST.get('max_deposit_amount') else None,
                daily_deposit_limit=Decimal(request.POST.get('daily_deposit_limit')) if request.POST.get('daily_deposit_limit') else None,
                monthly_deposit_limit=Decimal(request.POST.get('monthly_deposit_limit')) if request.POST.get('monthly_deposit_limit') else None,
                is_active=request.POST.get('is_active') == 'on',
                is_default=request.POST.get('is_default') == 'on',
            )
            messages.success(request, f'Bank account {bank.bank_name} created successfully.')
            return redirect('adminpanel:bank_list')
        except Exception as e:
            messages.error(request, f'Error creating bank account: {str(e)}')
    
    context = {
        'active': 'banks',
        'is_edit': False,
    }
    return render(request, 'sa/bank_form.html', context)


@staff_member_required
def bank_edit(request, bank_id):
    """Edit an admin bank account"""
    bank = get_object_or_404(AdminBank, id=bank_id)
    
    if request.method == 'POST':
        try:
            bank.bank_name = request.POST.get('bank_name')
            bank.account_number = request.POST.get('account_number')
            bank.account_name = request.POST.get('account_name')
            bank.branch = request.POST.get('branch', '')
            bank.swift_code = request.POST.get('swift_code', '')
            bank.routing_number = request.POST.get('routing_number', '')
            bank.min_deposit_amount = Decimal(request.POST.get('min_deposit_amount', '100'))
            bank.max_deposit_amount = Decimal(request.POST.get('max_deposit_amount')) if request.POST.get('max_deposit_amount') else None
            bank.daily_deposit_limit = Decimal(request.POST.get('daily_deposit_limit')) if request.POST.get('daily_deposit_limit') else None
            bank.monthly_deposit_limit = Decimal(request.POST.get('monthly_deposit_limit')) if request.POST.get('monthly_deposit_limit') else None
            bank.is_active = request.POST.get('is_active') == 'on'
            bank.is_default = request.POST.get('is_default') == 'on'
            bank.save()
            
            messages.success(request, f'Bank account {bank.bank_name} updated successfully.')
            return redirect('adminpanel:bank_list')
        except Exception as e:
            messages.error(request, f'Error updating bank account: {str(e)}')
    
    context = {
        'active': 'banks',
        'bank': bank,
        'is_edit': True,
    }
    return render(request, 'sa/bank_form.html', context)


@staff_member_required
@require_POST
def bank_toggle_status(request, bank_id):
    """Toggle bank active status"""
    try:
        bank = get_object_or_404(AdminBank, id=bank_id)
        bank.is_active = not bank.is_active
        bank.save()
        
        return JsonResponse({
            'success': True,
            'is_active': bank.is_active,
            'message': f'Bank {"activated" if bank.is_active else "deactivated"} successfully.'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def bank_delete(request, bank_id):
    """Delete a bank account"""
    try:
        bank = get_object_or_404(AdminBank, id=bank_id)
        
        # Check if bank has any deposit requests
        if bank.deposit_requests.exists():
            return JsonResponse({
                'success': False,
                'error': 'Cannot delete bank with existing deposit requests. Deactivate it instead.'
            }, status=400)
        
        bank_name = bank.bank_name
        bank.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Bank account {bank_name} deleted successfully.'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# ============= DEPOSIT MANAGEMENT =============

@staff_member_required
def deposit_list(request):
    """List all deposit requests with filters"""
    # Get filter parameters
    status_filter = request.GET.get('status', '')
    bank_filter = request.GET.get('bank', '')
    search_query = request.GET.get('q', '')
    date_from = request.GET.get('date_from', '')
    date_to = request.GET.get('date_to', '')
    
    # Start with all deposits
    deposits = DepositRequest.objects.all().select_related('user', 'admin_bank').order_by('-created_at')
    
    # Apply filters
    if status_filter:
        deposits = deposits.filter(status=status_filter)
    
    if bank_filter:
        deposits = deposits.filter(admin_bank_id=bank_filter)
    
    if search_query:
        deposits = deposits.filter(
            Q(user__username__icontains=search_query) |
            Q(user__email__icontains=search_query) |
            Q(reference__icontains=search_query) |
            Q(source_account_name__icontains=search_query) |
            Q(source_account_number__icontains=search_query)
        )
    
    if date_from:
        deposits = deposits.filter(created_at__gte=date_from)
    
    if date_to:
        deposits = deposits.filter(created_at__lte=date_to)
    
    # Statistics
    stats = {
        'total_count': deposits.count(),
        'total_amount': deposits.aggregate(total=Sum('amount'))['total'] or 0,
        'total_pending': deposits.filter(status='pending').count(),
        'total_processing': deposits.filter(status='processing').count(),
        'total_completed': deposits.filter(status='completed').count(),
        'total_failed': deposits.filter(status='failed').count(),
        'total_expired': deposits.filter(status='expired').count(),
    }
    
    # Pagination
    paginator = Paginator(deposits, 25)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)
    
    # Get all banks for filter dropdown
    banks = AdminBank.objects.filter(is_active=True)
    
    context = {
        'active': 'deposits',
        'page_obj': page_obj,
        'stats': stats,
        'banks': banks,
        'status_filter': status_filter,
        'bank_filter': bank_filter,
        'search_query': search_query,
        'date_from': date_from,
        'date_to': date_to,
        'status_choices': DepositRequest.STATUS_CHOICES,
    }
    
    return render(request, 'sa/deposit_list.html', context)


@staff_member_required
def deposit_detail(request, reference):
    """View deposit request details"""
    deposit = get_object_or_404(
        DepositRequest.objects.select_related('user', 'admin_bank'),
        reference=reference
    )
    
    # Get related transactions
    transactions = WalletTransaction.objects.filter(
        user=deposit.user,
        meta__deposit_reference=reference
    ).order_by('-created_at')
    
    # Get user's recent deposits
    recent_deposits = DepositRequest.objects.filter(
        user=deposit.user
    ).exclude(pk=deposit.pk).order_by('-created_at')[:5]
    
    # Calculate net amount
    net_amount = deposit.amount - deposit.processing_fee
    
    context = {
        'active': 'deposits',
        'deposit': deposit,
        'transactions': transactions,
        'recent_deposits': recent_deposits,
        'net_amount': net_amount,
    }
    
    return render(request, 'sa/deposit_detail.html', context)


@staff_member_required
@require_POST
def approve_deposit(request, reference):
    """Approve a deposit request and credit user wallet"""
    try:
        data = json.loads(request.body) if request.body else {}
        admin_notes = data.get('admin_notes', '')
        
        with db_transaction.atomic():
            deposit = get_object_or_404(
                DepositRequest.objects.select_for_update(),
                reference=reference
            )
            
            # Check if already processed
            if deposit.status in ['completed', 'failed', 'expired']:
                return JsonResponse({
                    'success': False,
                    'error': f'Deposit is already {deposit.status}'
                }, status=400)
            
            # Get or create wallet
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=deposit.user)
            
            # Split amount equally between balance and spot_balance
            total_amount = deposit.amount
            half_amount = (total_amount / Decimal('2')).quantize(Decimal('0.01'))
            
            # Check if this is the first deposit
            has_previous_successful_deposit = DepositRequest.objects.filter(
                user=deposit.user,
                status='completed'
            ).exclude(id=deposit.id).exists()
            
            # Create wallet transaction
            wallet_tx = WalletTransaction.objects.create(
                user=deposit.user,
                amount=deposit.amount,
                tx_type=WalletTransaction.CREDIT,
                reference=f"DEP{timezone.now().strftime('%Y%m%d%H%M%S')}{deposit.id}",
                first_deposit=not has_previous_successful_deposit,
                meta={
                    'status': 'completed',
                    'deposit_reference': deposit.reference,
                    'admin_bank': {
                        'id': deposit.admin_bank.id,
                        'name': deposit.admin_bank.bank_name,
                        'account_number': deposit.admin_bank.account_number,
                    },
                    'approved_by': request.user.username,
                    'approved_at': str(timezone.now()),
                    'distribution': {
                        'total': str(total_amount),
                        'to_balance': str(half_amount),
                        'to_spot_balance': str(half_amount)
                    }
                }
            )
            
            # Update wallet balances
            wallet.balance += half_amount
            wallet.spot_balance += half_amount
            wallet.save()
            
            # Update deposit request
            deposit.status = 'completed'
            deposit.completed_at = timezone.now()
            deposit.approved_at = timezone.now()
            deposit.transaction_reference = wallet_tx.reference
            if admin_notes:
                deposit.admin_notes = admin_notes
            deposit.meta.update({
                'approved_by': request.user.username,
                'approved_at': str(timezone.now()),
                'wallet_transaction_id': wallet_tx.id,
                'distribution': {
                    'to_balance': str(half_amount),
                    'to_spot_balance': str(half_amount)
                }
            })
            deposit.save()
            
            # Send completion email
            try:
                send_deposit_confirmation_email(deposit.user, deposit)
            except Exception as e:
                print(f"Email error: {e}")
        
        return JsonResponse({
            'success': True,
            'message': f'Deposit approved successfully. ₦{half_amount} added to balance and ₦{half_amount} added to spot balance.',
            'deposit': {
                'id': deposit.id,
                'reference': deposit.reference,
                'status': deposit.status,
                'completed_at': deposit.completed_at,
                'amount': float(deposit.amount),
                'balance_added': float(half_amount),
                'spot_added': float(half_amount)
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def decline_deposit(request, reference):
    """Decline a deposit request"""
    try:
        data = json.loads(request.body) if request.body else {}
        admin_notes = data.get('admin_notes', 'Reason for declining is required.')
        
        if not admin_notes:
            return JsonResponse({
                'success': False,
                'error': 'Please provide a reason for declining.'
            }, status=400)
        
        deposit = get_object_or_404(DepositRequest, reference=reference)
        
        # Check if already processed
        if deposit.status in ['completed', 'failed', 'expired']:
            return JsonResponse({
                'success': False,
                'error': f'Deposit is already {deposit.status}'
            }, status=400)
        
        # Update deposit request
        deposit.status = 'failed'
        deposit.admin_notes = admin_notes
        deposit.meta.update({
            'declined_by': request.user.username,
            'declined_at': str(timezone.now()),
            'decline_reason': admin_notes
        })
        deposit.save()
        
        # Update related wallet transaction if exists
        if deposit.transaction_reference:
            WalletTransaction.objects.filter(
                reference=deposit.transaction_reference
            ).update(
                meta__status='failed',
                meta__declined_at=str(timezone.now()),
                meta__decline_reason=admin_notes
            )
        
        return JsonResponse({
            'success': True,
            'message': 'Deposit declined successfully.',
            'deposit': {
                'id': deposit.id,
                'reference': deposit.reference,
                'status': deposit.status,
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def mark_as_processing(request, reference):
    """Mark deposit as being processed"""
    try:
        deposit = get_object_or_404(DepositRequest, reference=reference)
        
        if deposit.status != 'pending':
            return JsonResponse({
                'success': False,
                'error': f'Cannot mark {deposit.status} deposit as processing.'
            }, status=400)
        
        deposit.status = 'processing'
        deposit.meta.update({
            'processing_started_by': request.user.username,
            'processing_started_at': str(timezone.now()),
        })
        deposit.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Deposit marked as processing.',
            'deposit': {
                'id': deposit.id,
                'reference': deposit.reference,
                'status': deposit.status,
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def bulk_update_deposits(request):
    """Bulk update deposit statuses"""
    try:
        data = json.loads(request.body)
        deposit_ids = data.get('deposit_ids', [])
        action = data.get('action')  # 'approve', 'decline', 'processing'
        admin_notes = data.get('admin_notes', '')
        
        if action not in ['approve', 'decline', 'processing']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid action'
            }, status=400)
        
        if action == 'decline' and not admin_notes:
            return JsonResponse({
                'success': False,
                'error': 'Please provide a reason for declining.'
            }, status=400)
        
        updated_count = 0
        errors = []
        
        for deposit_id in deposit_ids:
            try:
                deposit = DepositRequest.objects.get(id=deposit_id)
                
                if action == 'approve' and deposit.status in ['pending', 'processing']:
                    # Use the approve function
                    request.body = json.dumps({'admin_notes': admin_notes})
                    response = approve_deposit(request, deposit.reference)
                    if response.status_code == 200:
                        updated_count += 1
                    else:
                        errors.append(f"Deposit {deposit.reference}: {response.data.get('error')}")
                
                elif action == 'decline' and deposit.status in ['pending', 'processing']:
                    request.body = json.dumps({'admin_notes': admin_notes})
                    response = decline_deposit(request, deposit.reference)
                    if response.status_code == 200:
                        updated_count += 1
                    else:
                        errors.append(f"Deposit {deposit.reference}: {response.data.get('error')}")
                
                elif action == 'processing' and deposit.status == 'pending':
                    deposit.status = 'processing'
                    deposit.meta.update({
                        'processing_started_by': request.user.username,
                        'processing_started_at': str(timezone.now()),
                    })
                    deposit.save()
                    updated_count += 1
                    
            except DepositRequest.DoesNotExist:
                errors.append(f"Deposit ID {deposit_id} not found")
            except Exception as e:
                errors.append(f"Error processing {deposit_id}: {str(e)}")
        
        return JsonResponse({
            'success': True,
            'updated_count': updated_count,
            'errors': errors,
            'message': f'Successfully updated {updated_count} deposits.'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def delete_deposit(request, reference):
    """Delete a deposit request"""
    try:
        deposit = get_object_or_404(DepositRequest, reference=reference)
        
        # Don't allow deletion of completed deposits
        if deposit.status == 'completed':
            return JsonResponse({
                'success': False,
                'error': 'Cannot delete completed deposits'
            }, status=400)
        
        # Store info for audit
        deletion_info = {
            'user': str(deposit.user),
            'amount': float(deposit.amount),
            'status': deposit.status,
            'deleted_by': str(request.user),
            'deleted_at': timezone.now().isoformat()
        }
        
        deposit.delete()
        
        return JsonResponse({
            'success': True,
            'message': f'Deposit #{reference} deleted successfully'
        })
        
    except DepositRequest.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Deposit not found'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


# ============= WITHDRAWAL MANAGEMENT =============

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
def approve_withdrawal(request, reference):
    """Approve a withdrawal request"""
    try:
        data = json.loads(request.body) if request.body else {}
        admin_notes = data.get('admin_notes', '')
        
        withdrawal = get_object_or_404(WithdrawalRequest, reference=reference)
        
        # Check if already processed
        if withdrawal.status in ['completed', 'failed', 'cancelled']:
            return JsonResponse({
                'success': False,
                'error': f'Withdrawal is already {withdrawal.status}'
            }, status=400)
        
        # Update withdrawal
        withdrawal.status = 'completed'
        if admin_notes:
            withdrawal.admin_notes = admin_notes
        withdrawal.meta.update({
            'approved_by': request.user.username,
            'approved_at': str(timezone.now()),
        })
        withdrawal.save()
        
        # Update related wallet transaction - FIXED: update the JSON meta field directly
        wallet_transactions = WalletTransaction.objects.filter(
            meta__withdrawal_reference=reference
        )
        
        for transaction in wallet_transactions:
            # Update the meta JSON field
            transaction.meta['status'] = 'completed'
            transaction.meta['approved_by'] = request.user.username
            transaction.meta['approved_at'] = str(timezone.now())
            transaction.save()
        
        # Send completion email
        try:
            send_withdrawal_completion_email(withdrawal.user, withdrawal)
        except Exception as e:
            print(f"Email error: {e}")
        
        return JsonResponse({
            'success': True,
            'message': 'Withdrawal approved successfully.',
            'withdrawal': {
                'id': withdrawal.id,
                'reference': withdrawal.reference,
                'status': withdrawal.status,
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def decline_withdrawal(request, reference):
    """Decline a withdrawal request"""
    try:
        data = json.loads(request.body) if request.body else {}
        admin_notes = data.get('admin_notes', 'Reason for declining is required.')
        
        if not admin_notes:
            return JsonResponse({
                'success': False,
                'error': 'Please provide a reason for declining.'
            }, status=400)
        
        withdrawal = get_object_or_404(WithdrawalRequest, reference=reference)
        
        # Check if already processed
        if withdrawal.status in ['completed', 'failed', 'cancelled']:
            return JsonResponse({
                'success': False,
                'error': f'Withdrawal is already {withdrawal.status}'
            }, status=400)
        
        # Update withdrawal
        withdrawal.status = 'failed'
        withdrawal.admin_notes = admin_notes
        withdrawal.meta.update({
            'declined_by': request.user.username,
            'declined_at': str(timezone.now()),
            'decline_reason': admin_notes
        })
        withdrawal.save()
        
        # Update related wallet transaction - FIXED: update the JSON meta field directly
        wallet_transactions = WalletTransaction.objects.filter(
            meta__withdrawal_reference=reference
        )
        
        for transaction in wallet_transactions:
            # Update the meta JSON field
            transaction.meta['status'] = 'failed'
            transaction.meta['declined_by'] = request.user.username
            transaction.meta['declined_at'] = str(timezone.now())
            transaction.meta['decline_reason'] = admin_notes
            transaction.save()
        
        # Refund the amount back to user's spot balance
        with db_transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user=withdrawal.user)
            wallet.spot_balance += withdrawal.amount
            wallet.save()
            
            # Create refund transaction
            WalletTransaction.objects.create(
                user=withdrawal.user,
                amount=withdrawal.amount,
                tx_type=WalletTransaction.CREDIT,
                reference=f"REF{timezone.now().strftime('%Y%m%d%H%M%S')}{withdrawal.id}",
                meta={
                    'status': 'completed',
                    'type': 'withdrawal_refund',
                    'withdrawal_reference': reference,
                    'reason': admin_notes,
                    'refunded_by': request.user.username,
                    'refunded_at': str(timezone.now()),
                }
            )
        
        return JsonResponse({
            'success': True,
            'message': 'Withdrawal declined and amount refunded to user.',
            'withdrawal': {
                'id': withdrawal.id,
                'reference': withdrawal.reference,
                'status': withdrawal.status,
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def mark_withdrawal_processing(request, reference):
    """Mark withdrawal as processing"""
    try:
        withdrawal = get_object_or_404(WithdrawalRequest, reference=reference)
        
        if withdrawal.status != 'pending':
            return JsonResponse({
                'success': False,
                'error': f'Cannot mark {withdrawal.status} withdrawal as processing.'
            }, status=400)
        
        withdrawal.status = 'processing'
        withdrawal.meta.update({
            'processing_started_by': request.user.username,
            'processing_started_at': str(timezone.now()),
        })
        withdrawal.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Withdrawal marked as processing.',
            'withdrawal': {
                'id': withdrawal.id,
                'reference': withdrawal.reference,
                'status': withdrawal.status,
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def bulk_update_withdrawals(request):
    """Bulk update withdrawal statuses"""
    try:
        data = json.loads(request.body)
        withdrawal_ids = data.get('withdrawal_ids', [])
        action = data.get('action')  # 'approve', 'decline', 'processing'
        admin_notes = data.get('admin_notes', '')
        
        if action not in ['approve', 'decline', 'processing']:
            return JsonResponse({
                'success': False,
                'error': 'Invalid action'
            }, status=400)
        
        if action == 'decline' and not admin_notes:
            return JsonResponse({
                'success': False,
                'error': 'Please provide a reason for declining.'
            }, status=400)
        
        updated_count = 0
        errors = []
        
        for withdrawal_id in withdrawal_ids:
            try:
                withdrawal = WithdrawalRequest.objects.get(reference=withdrawal_id)
                
                if action == 'approve' and withdrawal.status in ['pending', 'processing']:
                    request.body = json.dumps({'admin_notes': admin_notes})
                    response = approve_withdrawal(request, withdrawal.reference)
                    if response.status_code == 200:
                        updated_count += 1
                    else:
                        errors.append(f"Withdrawal {withdrawal.reference}: {response.data.get('error')}")
                
                elif action == 'decline' and withdrawal.status in ['pending', 'processing']:
                    request.body = json.dumps({'admin_notes': admin_notes})
                    response = decline_withdrawal(request, withdrawal.reference)
                    if response.status_code == 200:
                        updated_count += 1
                    else:
                        errors.append(f"Withdrawal {withdrawal.reference}: {response.data.get('error')}")
                
                elif action == 'processing' and withdrawal.status == 'pending':
                    withdrawal.status = 'processing'
                    withdrawal.meta.update({
                        'processing_started_by': request.user.username,
                        'processing_started_at': str(timezone.now()),
                    })
                    withdrawal.save()
                    updated_count += 1
                    
            except WithdrawalRequest.DoesNotExist:
                errors.append(f"Withdrawal {withdrawal_id} not found")
            except Exception as e:
                errors.append(f"Error processing {withdrawal_id}: {str(e)}")
        
        return JsonResponse({
            'success': True,
            'updated_count': updated_count,
            'errors': errors,
            'message': f'Successfully updated {updated_count} withdrawals.'
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@staff_member_required
@require_POST
def delete_withdrawal(request, reference):
    """Delete a withdrawal request"""
    try:
        withdrawal = get_object_or_404(WithdrawalRequest, reference=reference)
        
        # Don't allow deletion of completed withdrawals
        if withdrawal.status == 'completed':
            return JsonResponse({
                'success': False,
                'error': 'Cannot delete completed withdrawals'
            }, status=400)
        
        # Store info for audit
        deletion_info = {
            'user': str(withdrawal.user),
            'amount': float(withdrawal.amount),
            'status': withdrawal.status,
            'deleted_by': str(request.user),
            'deleted_at': timezone.now().isoformat()
        }
        
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


# ============= ORIGINAL FUNCTIONS (KEPT AS IS) =============

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


from collections import defaultdict
from django.db.models import Exists, OuterRef

@staff_member_required
def referral_list(request):
    """
    Referral overview grouped by referrer.

    Successful referral:
    - Referred user has at least ONE WalletTransaction with first_deposit=True
    """

    # ----------------------------------------------------
    # Subquery: does a user have a first deposit?
    # ----------------------------------------------------
    first_deposit_subquery = WalletTransaction.objects.filter(
        user=OuterRef("pk"),
        first_deposit=True,
    )

    # ----------------------------------------------------
    # Fetch all referred users (annotated)
    # ----------------------------------------------------
    referred_users = (
        User.objects
        .filter(referred_by__isnull=False)
        .select_related("referred_by")
        .annotate(
            has_first_deposit=Exists(first_deposit_subquery)
        )
        .order_by("-date_joined")
    )

    # ----------------------------------------------------
    # Group data by referrer
    # ----------------------------------------------------
    grouped = defaultdict(lambda: {
        "user": None,
        "total": 0,
        "successful": 0,
        "referrals": [],
    })

    for user in referred_users:
        referrer = user.referred_by

        bucket = grouped[referrer.id]

        # Set referrer once
        if bucket["user"] is None:
            bucket["user"] = referrer

        bucket["total"] += 1

        if user.has_first_deposit:
            bucket["successful"] += 1

        bucket["referrals"].append(user)

    # ----------------------------------------------------
    # Convert grouped dict → list (template-friendly)
    # ----------------------------------------------------
    referral_summary = list(grouped.values())

    # Optional: sort by highest conversions
    referral_summary.sort(
        key=lambda x: (x["successful"], x["total"]),
        reverse=True
    )

    return render(
        request,
        "sa/referral_list.html",
        {
            "referral_summary": referral_summary,
        }
    )


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