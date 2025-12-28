from django.urls import path
from . import views

app_name = "adminpanel"

urlpatterns = [
    path("admin_login/", views.admin_login, name="admin_login"),
    path("", views.dashboard, name="dashboard"),
    path("users/", views.users, name="users"),
    path("users/<int:user_id>/", views.admin_user_detail, name="admin_user_detail"),
    path("users/<int:user_id>/delete/", views.admin_delete_user, name="admin_delete_user"),
    path("referrals/", views.referral_list, name="referral_list"),
    path("referrals/<int:user_id>/", views.referral_detail, name="referral_detail"),
]

