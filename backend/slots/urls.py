from django.urls import path
from . import views

urlpatterns = [
    path('spin/', views.spin_slots, name='spin_slots'),
]