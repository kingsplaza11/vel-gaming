# wallets/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.wallet import WalletViewSet, wallet_transactions
from .webhooks import otpay_webhook, otpay_webhook_debug

router = DefaultRouter()
router.register(r'', WalletViewSet, basename='wallet')

# Create individual views for each action
check_status_view = WalletViewSet.as_view({
    'get': 'check_payment_status'
})
urlpatterns = [
    # Include all router URLs
    path('', include(router.urls)),
    
    # Explicitly add all endpoints
    path('check-payment-status/', check_status_view, name='wallet-check-status'),
    
    # Other endpoints
    path("transactions/", wallet_transactions),
    path('webhook/otpay/', otpay_webhook, name='otpay-webhook'),
    path('webhook/otpay-debug/', otpay_webhook_debug, name='otpay-webhook-debug'),
]