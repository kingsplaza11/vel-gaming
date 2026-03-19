# wallets/utils/email_service.py

import logging
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

logger = logging.getLogger(__name__)

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
            'status': deposit_request.get_status_display(),
            'support_email': settings.SUPPORT_EMAIL or 'support@example.com',
            'support_whatsapp': settings.SUPPORT_WHATSAPP or '+1234567890',
            'site_name': settings.SITE_NAME or 'Veltro Games',
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
            reply_to=[settings.DEFAULT_REPLY_TO_EMAIL] if hasattr(settings, 'DEFAULT_REPLY_TO_EMAIL') else None
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


def send_deposit_completion_email(user, deposit_request):
    """
    Send notification email when deposit is completed
    """
    try:
        subject = f"Deposit Completed Successfully - Reference: {deposit_request.reference}"
        
        # Calculate split amounts
        half_amount = deposit_request.amount / 2
        
        context = {
            'user': user,
            'deposit': deposit_request,
            'amount': deposit_request.amount,
            'half_amount': half_amount,
            'reference': deposit_request.reference,
            'completed_at': deposit_request.completed_at,
            'bank_name': deposit_request.admin_bank.bank_name,
            'support_email': settings.SUPPORT_EMAIL or 'support@example.com',
            'site_name': settings.SITE_NAME or 'Veltro Games',
        }
        
        html_content = render_to_string('emails/deposit_completed.html', context)
        text_content = strip_tags(html_content)
        
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email]
        )
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        
        logger.info(f"Deposit completion email sent to {user.email} for reference {deposit_request.reference}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send deposit completion email: {str(e)}")
        return False


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
            'support_email': settings.SUPPORT_EMAIL or 'support@example.com',
            'support_whatsapp': settings.SUPPORT_WHATSAPP or '+1234567890',
            'site_name': settings.SITE_NAME or 'Veltro Games',
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
            reply_to=[settings.DEFAULT_REPLY_TO_EMAIL] if hasattr(settings, 'DEFAULT_REPLY_TO_EMAIL') else None
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


def send_withdrawal_completion_email(user, withdrawal_request):
    """
    Send notification email when withdrawal is completed
    """
    try:
        subject = f"Withdrawal Completed Successfully - Reference: {withdrawal_request.reference}"
        
        context = {
            'user': user,
            'withdrawal': withdrawal_request,
            'amount': withdrawal_request.amount,
            'net_amount': withdrawal_request.amount - withdrawal_request.processing_fee,
            'reference': withdrawal_request.reference,
            'completed_at': withdrawal_request.updated_at,
            'bank_name': withdrawal_request.bank_name,
            'account_number': withdrawal_request.account_number,
            'support_email': settings.SUPPORT_EMAIL or 'support@example.com',
            'site_name': settings.SITE_NAME or 'Veltro Games',
        }
        
        html_content = render_to_string('emails/withdrawal_completed.html', context)
        text_content = strip_tags(html_content)
        
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email]
        )
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        
        logger.info(f"Withdrawal completion email sent to {user.email} for reference {withdrawal_request.reference}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send withdrawal completion email: {str(e)}")
        return False


def send_withdrawal_declined_email(user, withdrawal_request, reason):
    """
    Send notification email when withdrawal is declined
    """
    try:
        subject = f"Withdrawal Declined - Reference: {withdrawal_request.reference}"
        
        context = {
            'user': user,
            'withdrawal': withdrawal_request,
            'amount': withdrawal_request.amount,
            'reference': withdrawal_request.reference,
            'reason': reason,
            'bank_name': withdrawal_request.bank_name,
            'support_email': settings.SUPPORT_EMAIL or 'support@example.com',
            'site_name': settings.SITE_NAME or 'Veltro Games',
        }
        
        html_content = render_to_string('emails/withdrawal_declined.html', context)
        text_content = strip_tags(html_content)
        
        email = EmailMultiAlternatives(
            subject=subject,
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email]
        )
        email.attach_alternative(html_content, "text/html")
        email.send(fail_silently=False)
        
        logger.info(f"Withdrawal declined email sent to {user.email} for reference {withdrawal_request.reference}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send withdrawal declined email: {str(e)}")
        return False



# wallets/utils/email_service.py - Update with async sending

import threading

def send_email_async(subject, template_name, context, to_email):
    """Send email asynchronously in a background thread"""
    
    def _send():
        try:
            # Render templates
            html_content = render_to_string(f'emails/{template_name}.html', context)
            text_content = strip_tags(html_content)
            
            # Create email
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[to_email],
            )
            email.attach_alternative(html_content, "text/html")
            
            # Send with timeout
            email.send(fail_silently=True)
            
            logger.info(f"Email sent successfully to {to_email}")
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
    
    # Start background thread
    thread = threading.Thread(target=_send)
    thread.daemon = True
    thread.start()
    
    return True


def send_deposit_confirmation_email(user, deposit_request):
    """
    Send confirmation email to user after they mark deposit as paid
    """
    try:
        subject = f"Deposit Request Received - Reference: {deposit_request.reference}"
        
        # Simple context
        context = {
            'username': user.username,
            'amount': f"{deposit_request.amount:,.2f}",
            'reference': deposit_request.reference,
            'bank_name': deposit_request.admin_bank.bank_name,
            'account_number': deposit_request.admin_bank.account_number,
            'account_name': deposit_request.admin_bank.account_name,
            'created_at': deposit_request.created_at.strftime("%Y-%m-%d %H:%M"),
            'support_email': 'support@veltrogames.com',
            'site_name': 'Veltro Games',
        }
        
        # Send asynchronously
        send_email_async(
            subject=subject,
            template_name='deposit_confirmation',
            context=context,
            to_email=user.email
        )
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initiate deposit confirmation email: {str(e)}")
        return False


def send_withdrawal_confirmation_email(user, withdrawal_request, wallet_transaction):
    """
    Send confirmation email to user after withdrawal request submission
    """
    try:
        subject = f"Withdrawal Request Submitted - Reference: {withdrawal_request.reference}"
        
        net_amount = withdrawal_request.amount - withdrawal_request.processing_fee
        
        context = {
            'username': user.username,
            'amount': f"{withdrawal_request.amount:,.2f}",
            'processing_fee': f"{withdrawal_request.processing_fee:,.2f}",
            'net_amount': f"{net_amount:,.2f}",
            'reference': withdrawal_request.reference,
            'account_name': withdrawal_request.account_name,
            'bank_name': withdrawal_request.bank_name,
            'account_number': withdrawal_request.account_number,
            'estimated_time': '24-48 hours',
            'support_email': 'support@veltrogames.com',
            'site_name': 'Veltro Games',
        }
        
        send_email_async(
            subject=subject,
            template_name='withdrawal_confirmation',
            context=context,
            to_email=user.email
        )
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to send withdrawal confirmation email: {str(e)}")
        return False