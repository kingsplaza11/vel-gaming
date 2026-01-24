from django.contrib import admin
from django.urls import path, include

from sa_conf import views

admin.site.login = views.admin_login


urlpatterns = [
    path('admin-panel/', admin.site.urls),
    path('admin/', include('sa_conf.urls')),
    path("admin_login/", views.admin_login, name="admin_login"),

    # Core / Accounts
    path('api/accounts/', include('accounts.urls')),

    # Casino Games
    path('api/slots/', include('slots.urls')),
    path('api/crash/', include('crash.urls')),
    path('api/fishing/', include('fishing.urls')),
    path('api/treasure/', include('treasure.urls')),
    path('api/dragon/', include('dragon.urls')),
    path('api/potion/', include('potion.urls')),
    path('api/pyramid/', include('pyramid.urls')),
    path('api/heist/', include('heist.urls')),
    path('api/tower/', include('tower.urls')),
    path('api/cards/', include('cards.urls')),
    path('api/colorswitch/', include('colorswitch.urls')),
    path('api/guessing/', include('guessing.urls')),
    path('api/minesweeper/', include('minesweeper.urls')),
    path('api/wallet/', include('wallets.urls')),

    # ✅ Fortune Games (NEW)
    path('api/fortune/', include('fortune.urls')),
]
