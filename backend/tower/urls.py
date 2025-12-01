from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_tower, name='start_tower'),
    path('build/', views.build_level, name='build_level'),
    path('cashout/', views.cash_out_tower, name='cash_out_tower'),
    path('stats/', views.get_tower_stats, name='tower_stats'),
    path('history/', views.get_tower_history, name='tower_history'),
]