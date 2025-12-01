from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/slots/', include('slots.urls')),
    path('api/crash/', include('crash.urls')),
    path('api/fishing/', include('fishing.urls')),
    path('api/treasure/', include('treasure.urls')),
    path('api/dragon/', include('dragon.urls')),
    path('api/miner/', include('miner.urls')),
    path('api/space/', include('space.urls')),
    path('api/potion/', include('potion.urls')),
    path('api/pyramid/', include('pyramid.urls')),
    path('api/heist/', include('heist.urls')),
    path('api/tower/', include('tower.urls')),
    path('api/cards/', include('cards.urls')),
    path('api/clicker/', include('clicker.urls')),
    path('api/colorswitch/', include('colorswitch.urls')),
    path('api/guessing/', include('guessing.urls')),
    path('api/minesweeper/', include('minesweeper.urls')),
]