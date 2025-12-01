# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('place-bet/', views.place_bet, name='place_bet'),
    path('cash-out/', views.cash_out, name='cash_out'),
    path('game-crashed/', views.game_crashed, name='game_crashed'),
    path('stats/', views.get_crash_stats, name='crash_stats'),
    path('history/', views.get_crash_history, name='crash_history'),
]
