# fortune/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("start/", views.start_session, name="fortune-start"),
    path("session/<uuid:session_id>/", views.session_state, name="fortune-state"),
    path("session/<uuid:session_id>/cashout/", views.cashout, name="fortune-cashout"),
]
