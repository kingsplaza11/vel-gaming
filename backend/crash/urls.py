from django.urls import path
from . import views

urlpatterns = [
    path("recent-rounds/", views.RecentRoundsView.as_view(), name="recent-rounds"),
    path("verify-round/", views.VerifyRoundView.as_view(), name="verify-round"),
    path('place-bet/', views.place_bet, name='crash_place_bet'),
    path('cash-out/', views.cash_out, name='crash_cash_out'),
    path('stats/', views.get_stats, name='crash_stats'),
    path('history/', views.get_history, name='crash_history'),
    path('cancel-bet/', views.cancel_bet, name='crash_cancel_bet'),
    
    # WebSocket URL (for channels routing)
    # Note: This would be handled by channels routing, not Django URL patterns
]

