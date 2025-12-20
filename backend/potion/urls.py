from django.urls import path
from . import views

urlpatterns = [
    path('brew-potion/', views.brew_potion, name='brew_potion'),
    path('stats/', views.get_potion_stats, name='potion_stats'),
    path('history/', views.get_potion_history, name='potion_history'),
    path('potion-type-stats/', views.get_potion_type_stats, name='potion_type_stats'),
    path('ingredient-stats/', views.get_ingredient_stats, name='ingredient_stats'),
]