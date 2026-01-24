from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.sites.shortcuts import get_current_site
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from django.urls import reverse
import json


User = get_user_model()

def send_password_reset_success_email(user_email, username):
    """Send confirmation email after successful password reset"""
    subject = "🎉 Password Reset Successful - Veltora Games"
    
    # Render HTML content
    html_content = render_to_string('registration/password_reset_confirm_email.html', {
        'user': type('obj', (object,), {'get_username': lambda: username})(),
    })
    
    # Create plain text version by stripping HTML tags
    text_content = strip_tags(html_content)
    
    email = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user_email],
    )
    
    email.attach_alternative(html_content, "text/html")
    email.send()

class PasswordResetAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '')
        form = PasswordResetForm({'email': email})

        if not form.is_valid():
            return Response(
                {'error': 'Please enter a valid email address'},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = form.cleaned_data['email']
        users = list(form.get_users(email))

        if users:
            user = users[0]

            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            protocol = 'https' if request.is_secure() else 'http'
            domain = request.get_host()

            context = {
                'email': user.email,
                'domain': domain,
                'site_name': get_current_site(request).name,
                'uid': uid,
                'user': user,
                'token': token,
                'protocol': protocol,
                'password_reset_confirm_url': (f"{protocol}://{domain}/password-reset-confirm/{uid}/{token}"),

            }

            html_content = render_to_string(
                'registration/password_reset_email.html',
                context
            )
            text_content = strip_tags(html_content)

            subject = "🔐 Reset Your Veltora Games Password"
            email_msg = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email_msg.attach_alternative(html_content, "text/html")
            email_msg.send()

        return Response(
            {
                "success": True,
                "message": "Password reset email has been sent to your email address. Please check your inbox (and spam folder)."
            },
            status=status.HTTP_200_OK
        )



class PasswordResetConfirmAPIView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        # Get data from request
        data = request.data
        
        # Extract parameters (they might come from URL or request body)
        uid = data.get('uid') or request.GET.get('uid')
        token = data.get('token') or request.GET.get('token')
        new_password1 = data.get('new_password1') or data.get('password')
        new_password2 = data.get('new_password2') or data.get('confirm_password')
        
        # Debug logging
        print(f"Password reset confirm received - UID: {uid}, Token: {token}")
        print(f"Password1: {new_password1}, Password2: {new_password2}")
        
        # Validate required fields
        if not uid or not token:
            return Response({
                'error': 'Missing uid or token in request'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not new_password1 or not new_password2:
            return Response({
                'error': 'Both password fields are required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if new_password1 != new_password2:
            return Response({
                'error': 'Passwords do not match'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Decode the uid
            try:
                uid_decoded = force_str(urlsafe_base64_decode(uid))
                user = User.objects.get(pk=uid_decoded)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                user = None
                return Response({
                    'error': 'Invalid reset link or user not found'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check token
            if user is not None and default_token_generator.check_token(user, token):
                # Create form with user and data
                form_data = {
                    'new_password1': new_password1,
                    'new_password2': new_password2
                }
                form = SetPasswordForm(user, form_data)
                
                if form.is_valid():
                    # Save the new password
                    form.save()
                    
                    # Send confirmation email
                    try:
                        send_password_reset_success_email(user.email, user.username)
                    except Exception as e:
                        print(f"Failed to send confirmation email: {e}")
                        # Continue even if email fails
                    
                    return Response({
                        'detail': 'Password has been reset successfully.',
                        'message': 'You can now login with your new password.',
                        'user': {
                            'id': user.id,
                            'username': user.username,
                            'email': user.email
                        }
                    })
                else:
                    # Return form validation errors
                    errors = {}
                    for field, error_list in form.errors.items():
                        errors[field] = error_list[0]
                    return Response({
                        'error': 'Password validation failed',
                        'errors': errors
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({
                    'error': 'Invalid reset link or token has expired'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            print(f"Error in password reset confirm: {str(e)}")
            return Response({
                'error': 'An error occurred while resetting password',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

