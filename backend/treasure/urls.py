from django.urls import path
from . import views

urlpatterns = [
    path('start-hunt/', views.start_hunt, name='start_hunt'),
    path('stats/', views.get_treasure_stats, name='treasure_stats'),
    path('history/', views.get_treasure_history, name='treasure_history'),
    path('level-stats/', views.get_level_stats, name='level_stats'),
]
