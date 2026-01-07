# slots/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('spin/', views.spin_slots, name='spin_slots'),
    path('stats/', views.get_slot_stats, name='slot_stats'),
    path('history/', views.get_slot_history, name='slot_history'),
    path('info/', views.get_slot_info, name='slot_info'),
]