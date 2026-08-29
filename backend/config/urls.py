"""Root URL configuration."""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def api_root(_request):
    return JsonResponse(
        {
            "name": "ELD Trip Planner API",
            "endpoints": {
                "health": "/api/health/",
                "plan_trip": "POST /api/trips/plan/",
                "trip_detail": "GET /api/trips/<uuid>/",
                "recent_trips": "GET /api/trips/",
                "admin": "/admin/",
            },
        }
    )


urlpatterns = [
    path("", api_root),
    path("admin/", admin.site.urls),
    path("api/", include("trips.urls")),
]
