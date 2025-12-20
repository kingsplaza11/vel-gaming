from django.urls import path
from . import views

app_name = "lightning_vault"

urlpatterns = [
    path("start/", views.start_game, name="start"),
    path("<int:session_id>/pulse/", views.pulse, name="pulse"),
    path("<int:session_id>/cashout/", views.cash_out, name="cashout"),
]
