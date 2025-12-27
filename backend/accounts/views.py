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
        login(request, user)
        return Response(UserSerializer(user).data, status=201)

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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def referral_dashboard(request):
    user = request.user
    referrals = user.referrals.all()

    now = timezone.now()
    day = now - timedelta(days=1)
    week = now - timedelta(days=7)
    month = now - timedelta(days=30)

    data = []

    for ref in referrals:
        txs = WalletTransaction.objects.filter(
            user=ref,
            tx_type="CREDIT"
        )

        data.append({
            "username": ref.username,
            "total": sum(t.amount for t in txs),
            "daily": sum(t.amount for t in txs.filter(created_at__gte=day)),
            "weekly": sum(t.amount for t in txs.filter(created_at__gte=week)),
            "monthly": sum(t.amount for t in txs.filter(created_at__gte=month)),
        })

    return Response({
        "referral_code": user.referral_code,
        "referral_link": f"https://veltoragames.com/register?ref={user.referral_code}",
        "referrals": data,
    })
