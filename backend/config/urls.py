from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from notes.views import NoteItemViewSet

items_router = DefaultRouter()
items_router.register('items', NoteItemViewSet, basename='item')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/admin/', include('accounts.admin_urls')),
    path('api/v1/notes/', include('notes.urls')),
    path('api/v1/transactions/', include('finance.urls')),
    path('api/v1/search/', include('search.urls')),
    path('api/v1/', include(items_router.urls)),
]
