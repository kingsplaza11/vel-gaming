from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_minesweeper, name='start_minesweeper'),
    path('reveal/', views.reveal_cell, name='reveal_cell'),
    path('cashout/', views.cash_out, name='cash_out'),
]