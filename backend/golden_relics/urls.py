from django.urls import path
from . import views

app_name = "golden_relics"

urlpatterns = [
    path("start/", views.start_game, name="start"),
    path("<int:session_id>/dig/", views.dig_relic, name="dig"),
    path("<int:session_id>/cashout/", views.cash_out, name="cashout"),
]
