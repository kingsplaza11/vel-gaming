from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate, logout, login
from rest_framework.decorators import api_view, permission_classes
from rest_framework import status
from rest_framework.response import Response
from .serializers import UserSerializer
from django.contrib.auth import update_session_auth_hash
from django.utils import timezone
from datetime import timedelta
from wallets.models import WalletTransaction

# utils/registration_email.py
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_registration_confirmation_email(user):
    """
    Send welcome/confirmation email to new user after registration
    """
    try:
        subject = f"Welcome to Veltro Gaming, {user.username}!"
        
        # Email context data
        context = {
            'user': user,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'referral_code': user.referral_code,
            'site_url': settings.SITE_URL if hasattr(settings, 'SITE_URL') else 'https://veltrogames.com',
            'support_email': 'support@veltrogames.com',
            'support_whatsapp': '+1 (825) 572-0351',
            'deposit_bonus': '10%',  # Example bonus info
            'min_deposit': '₦2000',
        }
        
        # Render HTML template
        html_content = render_to_string('emails/registration_confirmation.html', context)
        
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
        
        logger.info(f"Registration confirmation email sent to {user.email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send registration confirmation email to {user.email}: {str(e)}")
        return False

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_ticket(request):
    return Response({
        "success": True,
        "message": "Support ticket received. Our team will contact you."
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        
        # Log in the user
        login(request, user)
        
        # Send registration confirmation email
        try:
            email_sent = send_registration_confirmation_email(user)
            
            if email_sent:
                logger.info(f"Registration confirmation email sent to {user.email}")
            else:
                logger.warning(f"Failed to send registration confirmation email to {user.email}")
                
        except Exception as e:
            # Log error but don't fail registration
            logger.error(f"Error sending registration confirmation email: {str(e)}")
        
        # Prepare response data
        response_data = UserSerializer(user).data
        response_data['email_sent'] = email_sent if 'email_sent' in locals() else False
        
        return Response(response_data, status=201)
    
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)
    if user:
        login(request, user)
        return Response(UserSerializer(user).data)

    return Response({'error': 'Invalid credentials'}, status=400)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'message': 'Logged out successfully'})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def update_profile(request):
    user = request.user
    user.username = request.data.get("username", user.username)
    user.email = request.data.get("email", user.email)
    user.save()
    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    old = request.data.get("old_password")
    new = request.data.get("new_password")

    if not user.check_password(old):
        return Response({"error": "Incorrect old password"}, status=400)

    user.set_password(new)
    user.save()
    update_session_auth_hash(request, user)
    return Response({"success": True})


from django.utils.timezone import now, localdate
from datetime import timedelta
import calendar
from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def referral_dashboard(request):
    user = request.user
    referrals = user.referrals.all()

    today = localdate()
    yesterday = today - timedelta(days=1)

    # Monday → Sunday of CURRENT week
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    def stats_for_range(start_date=None, end_date=None):
        referred_users = referrals

        # Filter referred users by date_joined if date range is provided
        if start_date:
            referred_users = referred_users.filter(date_joined__date__gte=start_date)
        if end_date:
            referred_users = referred_users.filter(date_joined__date__lte=end_date)

        referred_count = referred_users.count()

        # Get the referred user IDs
        referred_user_ids = list(referred_users.values_list('id', flat=True))

        if not referred_user_ids:
            return {
                "referrals": 0,
                "successful": 0,
                "first_deposit_amount": 0.0,
                "total_deposit_amount": 0.0
            }

        # FIRST DEPOSITS (only first-time deposits) - these should be CREDIT transactions
        first_deposits_qs = WalletTransaction.objects.filter(
            user_id__in=referred_user_ids,
            first_deposit=True,
            tx_type='CREDIT',
            status="completed"
        )

        # TOTAL DEPOSITS (all successful CREDIT transactions from referred users)
        total_deposits_qs = WalletTransaction.objects.filter(
            user_id__in=referred_user_ids,
            tx_type='CREDIT',
            status="completed"

        )

        # Apply date filters if provided
        if start_date:
            first_deposits_qs = first_deposits_qs.filter(created_at__date__gte=start_date)
            total_deposits_qs = total_deposits_qs.filter(created_at__date__gte=start_date)
        if end_date:
            first_deposits_qs = first_deposits_qs.filter(created_at__date__lte=end_date)
            total_deposits_qs = total_deposits_qs.filter(created_at__date__lte=end_date)

        # Count users who made first deposits
        successful_count = first_deposits_qs.values("user").distinct().count()

        # Calculate total amounts
        first_deposit_amount = first_deposits_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        total_deposit_amount = total_deposits_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

        return {
            "referrals": referred_count,
            "successful": successful_count,
            "first_deposit_amount": float(first_deposit_amount),
            "total_deposit_amount": float(total_deposit_amount),
        }


    stats = {
        "today": stats_for_range(today, today),
        "yesterday": stats_for_range(yesterday, yesterday),
        "this_week": stats_for_range(week_start, week_end),
        "total": stats_for_range(),
    }

    return Response({
        "referral_code": user.referral_code,
        "referral_link": f"https://veltoragames.com/register?ref={user.referral_code}",
        "stats": stats,
    })