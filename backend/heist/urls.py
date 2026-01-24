from django.urls import path
from . import views

urlpatterns = [
    path('start-heist/', views.start_heist, name='start_heist'),
    path('stats/', views.get_heist_stats, name='heist_stats'),
    path('history/', views.get_heist_history, name='heist_history'),
]