from django.urls import path

from .admin_views import (
    AdminDetailView,
    AdminListCreateView,
    AdminLoginView,
    AdminLogoutView,
    AdminMeView,
    AdminUserDetailView,
    AdminUserListView,
    AISettingsView,
    ProRequestDetailView,
    ProRequestListView,
    TrialKeyDetailView,
    TrialKeyListCreateView,
)

urlpatterns = [
    path('login/', AdminLoginView.as_view(), name='admin-login'),
    path('logout/', AdminLogoutView.as_view(), name='admin-logout'),
    path('me/', AdminMeView.as_view(), name='admin-me'),
    path('users/', AdminUserListView.as_view(), name='admin-users'),
    path('users/<uuid:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admins/', AdminListCreateView.as_view(), name='admin-admins'),
    path('admins/<uuid:pk>/', AdminDetailView.as_view(), name='admin-admin-detail'),
    path('ai-settings/', AISettingsView.as_view(), name='admin-ai-settings'),
    path('trial-keys/', TrialKeyListCreateView.as_view(), name='admin-trial-keys'),
    path('trial-keys/<uuid:pk>/', TrialKeyDetailView.as_view(), name='admin-trial-key-detail'),
    path('pro-requests/', ProRequestListView.as_view(), name='admin-pro-requests'),
    path('pro-requests/<str:code>/', ProRequestDetailView.as_view(), name='admin-pro-request-detail'),
]
