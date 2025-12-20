from django.urls import path
from . import views

app_name = "fortune_dragon"

urlpatterns = [
    path("start/", views.start_game, name="start"),
    path("<int:session_id>/orb/", views.click_orb, name="orb"),
    path("<int:session_id>/cashout/", views.cash_out, name="cashout"),
]
