from django.urls import path
from . import views

urlpatterns = [
    path('cast-line/', views.cast_line, name='cast_line'),
    path('stats/', views.get_fishing_stats, name='fishing_stats'),
    path('history/', views.get_fishing_history, name='fishing_history'),
]
