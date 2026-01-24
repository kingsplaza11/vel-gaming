from django.urls import path
from . import views

urlpatterns = [
    # Main brewing endpoint
    path('brew-potion/', views.brew_potion, name='brew_potion'),
    
    # Statistics endpoints
    path('stats/', views.get_potion_stats, name='potion_stats'),
    path('history/', views.get_potion_history, name='potion_history'),
    
    # Note: The following endpoints from your old code don't exist in the new views.py:
    # - get_potion_type_stats() - Removed in updated version
    # - get_ingredient_stats() - Removed in updated version
    
    
    # New endpoints you might want to add (if needed):
    # path('alchemist-rank/', views.get_alchemist_rank, name='alchemist_rank'),
]