from django.urls import path
from . import views

urlpatterns = [
    path('spin/', views.spin_roulette, name='spin_roulette'),
    path('stats/', views.get_roulette_stats, name='roulette_stats'),
    path('history/', views.get_roulette_history, name='roulette_history'),
]