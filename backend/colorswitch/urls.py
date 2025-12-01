from django.urls import path
from . import views

urlpatterns = [
    path('start-game/', views.start_color_switch, name='start_color_switch'),
    path('submit-sequence/', views.submit_sequence, name='submit_sequence'),
    path('cash-out/', views.cash_out_colors, name='cash_out_colors'),
    path('stats/', views.get_color_switch_stats, name='color_switch_stats'),
    path('history/', views.get_color_switch_history, name='color_switch_history'),
]