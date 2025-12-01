from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_clicker, name='start_clicker'),
    path('click/', views.register_click, name='register_click'),
    path('stats/', views.get_clicker_stats, name='clicker_stats'),
    path('history/', views.get_clicker_history, name='clicker_history'),
]