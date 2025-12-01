from django.urls import path
from . import views

urlpatterns = [
    path('launch-mission/', views.launch_mission, name='launch_mission'),
    path('stats/', views.get_space_stats, name='space_stats'),
    path('history/', views.get_space_history, name='space_history'),
    path('mission-type-stats/', views.get_mission_type_stats, name='mission_type_stats'),
    path('planet-stats/', views.get_planet_stats, name='planet_stats'),
    path('resource-stats/', views.get_resource_stats, name='resource_stats'),
]