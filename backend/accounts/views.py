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

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def referral_dashboard(request):
    user = request.user
    referrals = user.referrals.all()

    # Get current date for week calculation
    today = localdate()
    # Get start of current week (Monday)
    start_of_week = today - timedelta(days=today.weekday())
    # Get start of day (today at 00:00)
    start_of_day = today

    data = []
    successful_referrals = 0
    
    for ref in referrals:
        print(f"Processing referral: {ref.username}")  # Debug
        
        # Get user's credit transactions
        txs = WalletTransaction.objects.filter(
            user=ref,
            tx_type="CREDIT"
        )
        
        # Get the first deposit transaction (if exists)
        first_deposit_tx = WalletTransaction.objects.filter(
            user=ref,
            tx_type="CREDIT",
            first_deposit=True
        ).first()
        
        # Get first deposit amount if exists, otherwise 0
        first_deposit_amount = Decimal('0.00')
        has_first_deposit = False
        
        if first_deposit_tx:
            print(f"Found first deposit for {ref.username}: {first_deposit_tx.amount}")  # Debug
            first_deposit_amount = first_deposit_tx.amount
            has_first_deposit = True
        else:
            print(f"No first deposit found for {ref.username}")  # Debug
        
        # Calculate today's deposits (transactions created today)
        daily_amount = sum(
            t.amount for t in txs.filter(
                created_at__date=start_of_day
            )
        ) or Decimal('0.00')
        
        # Calculate this week's deposits (Monday to Sunday)
        weekly_amount = sum(
            t.amount for t in txs.filter(
                created_at__date__gte=start_of_week
            )
        ) or Decimal('0.00')
        
        # Calculate total deposits
        total_amount = sum(t.amount for t in txs) or Decimal('0.00')
        
        # Count as successful if user has made first deposit
        if has_first_deposit:
            successful_referrals += 1
        
        data.append({
            "username": ref.username,
            "first_deposit": float(first_deposit_amount),  # Convert Decimal to float for JSON serialization
            "has_first_deposit": has_first_deposit,  # Keep for status check
            "deposit_today": float(daily_amount),
            "deposit_this_week": float(weekly_amount),
            "total_deposit": float(total_amount),
            "status": "successful" if has_first_deposit else "pending",
        })
        print(f"Data for {ref.username}: first_deposit={first_deposit_amount}, has_first_deposit={has_first_deposit}")  # Debug

    print(f"Final data being sent: {data}")  # Debug
    
    return Response({
        "referral_code": user.referral_code,
        "referral_link": f"https://veltoragames.com/register?ref={user.referral_code}",
        "total_referrals": referrals.count(),
        "successful_referrals": successful_referrals,
        "pending_referrals": referrals.count() - successful_referrals,
        "referrals": data,
    })