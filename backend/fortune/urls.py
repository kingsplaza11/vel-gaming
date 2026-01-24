# fortune/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Game configuration
    path("config/<str:game_type>/", views.game_config, name="fortune-config"),
    
    # Session management
    path("start/", views.start_session, name="fortune-start"),
    path("sessions/active/", views.active_sessions, name="fortune-active-sessions"),
    path("session/<uuid:session_id>/", views.session_state, name="fortune-state"),
    path("session/<uuid:session_id>/step/", views.take_step, name="fortune-step"),
    path("session/<uuid:session_id>/cashout/", views.cashout, name="fortune-cashout"),
    path("session/<uuid:session_id>/abandon/", views.abandon_session, name="fortune-abandon"),
    path("session/<uuid:session_id>/reveal-seed/", views.reveal_server_seed, name="fortune-reveal-seed"),
]