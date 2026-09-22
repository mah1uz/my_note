from django.urls import path

from .views import MeView, PreferenceResetView, PreferenceView, SettingsView

urlpatterns = [
    path('me/', MeView.as_view(), name='me'),
    path('preferences/', PreferenceView.as_view(), name='preferences'),
    path('preferences/reset/', PreferenceResetView.as_view(), name='preferences-reset'),
    path('settings/', SettingsView.as_view(), name='settings'),
]
