from django.urls import path
from . import views

urlpatterns = [
    path('explore-pyramid/', views.explore_pyramid, name='explore_pyramid'),
    path('stats/', views.get_pyramid_stats, name='pyramid_stats'),
    path('history/', views.get_pyramid_history, name='pyramid_history'),
]