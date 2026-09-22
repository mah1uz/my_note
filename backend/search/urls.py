from django.urls import path

from .views import SearchAnswerView, SearchView

urlpatterns = [
    path('', SearchView.as_view(), name='search'),
    path('answer/', SearchAnswerView.as_view(), name='search-answer'),
]
