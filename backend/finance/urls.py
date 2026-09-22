from rest_framework.routers import DefaultRouter

from .views import FinanceTransactionViewSet

router = DefaultRouter()
router.register('', FinanceTransactionViewSet, basename='transaction')

urlpatterns = router.urls
