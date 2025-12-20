from django.urls import path
from . import views

app_name = "mystic_totems"

urlpatterns = [
    path("start/", views.start_game, name="start"),
    path("<int:session_id>/reveal/", views.reveal, name="reveal"),
    path("<int:session_id>/cashout/", views.cash_out, name="cashout"),
]
