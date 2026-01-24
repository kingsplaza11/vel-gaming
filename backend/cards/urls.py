from django.urls import path
from . import views

urlpatterns = [
    path('start-game/', views.start_card_game, name='start_card_game'),
    path('reveal-card/', views.reveal_card, name='reveal_card'),
    path('cash-out/', views.cash_out_early, name='cash_out_early'),
    path('stats/', views.get_card_stats, name='card_stats'),
    path('history/', views.get_card_history, name='card_history'),
]