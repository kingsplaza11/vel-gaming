from django.urls import path
from . import views

urlpatterns = [
    path('start-battle/', views.start_battle, name='start_battle'),
    path('stats/', views.get_dragon_stats, name='dragon_stats'),
    path('history/', views.get_dragon_history, name='dragon_history'),
    path('element-stats/', views.get_element_stats, name='element_stats'),
    path('streak-stats/', views.get_streak_stats, name='streak_stats'),
]