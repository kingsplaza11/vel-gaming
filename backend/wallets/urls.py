from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.wallet import WalletViewSet, wallet_transactions
from .views.webhook import paystack_webhook

router = DefaultRouter()
router.register(r'', WalletViewSet, basename='wallet')  # This creates endpoints under /api/wallet/

urlpatterns = [
    path('', include(router.urls)),  # All wallet endpoints are under /api/wallet/
    path('webhook/paystack/', paystack_webhook, name='paystack-webhook'),
    path("transactions/", wallet_transactions),
    
]
