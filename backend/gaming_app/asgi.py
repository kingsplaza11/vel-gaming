import os
import django
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "gaming_app.settings")
django.setup()

# Import websocket routes
import crash.routing
import fortune.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),

    "websocket": AuthMiddlewareStack(
        URLRouter(
            crash.routing.websocket_urlpatterns +
            fortune.routing.websocket_urlpatterns
        )
    ),
})
