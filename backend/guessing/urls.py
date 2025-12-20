from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_guessing, name='start_guessing'),
    path('guess/', views.make_guess, name='make_guess'),
]