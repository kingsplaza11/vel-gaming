from django.urls import path
from .consumers import CrashConsumer

websocket_urlpatterns = [
    path("ws/crash/<str:mode>/", CrashConsumer.as_asgi()),
]
