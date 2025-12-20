# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path("recent-rounds/", views.RecentRoundsView.as_view(), name="recent-rounds"),
    path("verify-round/", views.VerifyRoundView.as_view(), name="verify-round"),
]
