# fortune/routing.py
from django.urls import re_path
from .consumers import FortuneConsumer

websocket_urlpatterns = [
    re_path(r"ws/fortune/$", FortuneConsumer.as_asgi()),
]
