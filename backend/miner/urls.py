from django.urls import path
from . import views

urlpatterns = [
    path('start-mining/', views.start_mining, name='start_mining'),
    path('stats/', views.get_mining_stats, name='mining_stats'),
    path('history/', views.get_mining_history, name='mining_history'),
    path('crypto-stats/', views.get_crypto_stats, name='crypto_stats'),
    path('leaderboard/', views.get_mining_leaderboard, name='mining_leaderboard'),
]