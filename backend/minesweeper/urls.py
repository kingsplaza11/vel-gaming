from django.urls import path
from . import views

urlpatterns = [
    path('start/', views.start_minesweeper, name='start_minesweeper'),
    path('reveal/', views.reveal_cell, name='reveal_cell'),
    path('cashout/', views.cash_out, name='cash_out'),
    # path('stats/', views.get_minesweeper_stats, name='minesweeper_stats'),
    # path('history/', views.get_minesweeper_history, name='minesweeper_history'),
]