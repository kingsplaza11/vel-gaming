from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_blackjack, name='start_blackjack'),
    path('hit/', views.hit_blackjack, name='hit_blackjack'),
    path('stand/', views.stand_blackjack, name='stand_blackjack'),
    # path('stats/', views.get_blackjack_stats, name='blackjack_stats'),
    # path('history/', views.get_blackjack_history, name='blackjack_history'),
]