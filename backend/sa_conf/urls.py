from django.urls import path
from . import views

app_name = "adminpanel"

urlpatterns = [
    # Authentication
    path("admin_login/", views.admin_login, name="admin_login"),
    
    # Dashboard
    path("", views.dashboard, name="dashboard"),
    
    # User Management
    path("users/", views.users, name="users"),
    path("users/<int:user_id>/", views.admin_user_detail, name="admin_user_detail"),
    path("users/<int:user_id>/delete/", views.admin_delete_user, name="admin_delete_user"),
    path("users/<int:user_id>/wallet/update/", views.update_wallet, name="update_wallet"),
    
    # Referral Management
    path("referrals/", views.referral_list, name="referral_list"),
    path("referrals/<int:user_id>/", views.referral_detail, name="referral_detail"),
    
    # ============= BANK MANAGEMENT =============
    path('banks/', views.bank_list, name='bank_list'),
    path('banks/create/', views.bank_create, name='bank_create'),
    path('banks/<int:bank_id>/edit/', views.bank_edit, name='bank_edit'),
    path('banks/<int:bank_id>/toggle-status/', views.bank_toggle_status, name='bank_toggle_status'),
    path('banks/<int:bank_id>/delete/', views.bank_delete, name='bank_delete'),
    
    # ============= DEPOSIT MANAGEMENT =============
    path('deposits/', views.deposit_list, name='deposit_list'),
    path('deposits/<str:reference>/', views.deposit_detail, name='deposit_detail'),
    path('deposits/<str:reference>/approve/', views.approve_deposit, name='approve_deposit'),
    path('deposits/<str:reference>/decline/', views.decline_deposit, name='decline_deposit'),
    path('deposits/<str:reference>/processing/', views.mark_as_processing, name='mark_deposit_processing'),
    path('deposits/<str:reference>/delete/', views.delete_deposit, name='delete_deposit'),
    path('deposits/bulk-update/', views.bulk_update_deposits, name='bulk_update_deposits'),
    
    # ============= WITHDRAWAL MANAGEMENT =============
    path('withdrawals/', views.withdrawal_list, name='withdrawal_list'),
    path('withdrawals/<str:reference>/', views.withdrawal_detail, name='withdrawal_detail'),
    path('withdrawals/<str:reference>/approve/', views.approve_withdrawal, name='approve_withdrawal'),
    path('withdrawals/<str:reference>/decline/', views.decline_withdrawal, name='decline_withdrawal'),
    path('withdrawals/<str:reference>/processing/', views.mark_withdrawal_processing, name='mark_withdrawal_processing'),
    path('withdrawals/<str:reference>/delete/', views.delete_withdrawal, name='delete_withdrawal'),
    path('withdrawals/bulk-update/', views.bulk_update_withdrawals, name='bulk_update_withdrawals'),
]