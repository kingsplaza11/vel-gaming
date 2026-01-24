from django.urls import path
from . import views
from .csrf import csrf
from . import api_views  # your custom API views


urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('profile/', views.profile_view, name='profile'),
    path("csrf/", csrf),

    path("update-profile/", views.update_profile),
    path("change-password/", views.change_password),
    path("ticket/", views.submit_ticket),
    path("referral_dashboard/", views.referral_dashboard),

    path('password/reset/', 
         api_views.PasswordResetAPIView.as_view(), 
         name='api_password_reset'),
    
    path('password/reset/confirm/', 
         api_views.PasswordResetConfirmAPIView.as_view(), 
         name='api_password_reset_confirm'),
]
