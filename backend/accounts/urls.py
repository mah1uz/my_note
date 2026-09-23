from django.urls import path

from .views import AiEntitlementView, MeView, OnboardingCompleteView, PreferenceResetView, PreferenceView, ProRequestView, SettingsView

urlpatterns = [
    path('me/', MeView.as_view(), name='me'),
    path('preferences/', PreferenceView.as_view(), name='preferences'),
    path('preferences/reset/', PreferenceResetView.as_view(), name='preferences-reset'),
    path('settings/', SettingsView.as_view(), name='settings'),
    path('ai/entitlement/', AiEntitlementView.as_view(), name='ai-entitlement'),
    path('onboarding/complete/', OnboardingCompleteView.as_view(), name='onboarding-complete'),
    path('pro/request/', ProRequestView.as_view(), name='pro-request'),
]
