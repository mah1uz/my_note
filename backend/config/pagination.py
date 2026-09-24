from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Fixed 50-row pages for heavy lists. No client override: page size is
    a server congestion guardrail, not a negotiation."""

    page_size = 50
    page_size_query_param = None
