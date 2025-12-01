from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_guessing, name='start_guessing'),
    path('guess/', views.make_guess, name='make_guess'),
    path('stats/', views.get_guessing_stats, name='guessing_stats'),
    path('history/', views.get_guessing_history, name='guessing_history'),
]