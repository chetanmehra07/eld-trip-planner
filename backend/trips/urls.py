from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.HealthView.as_view(), name="health"),
    path("trips/", views.TripListView.as_view(), name="trip-list"),
    path("trips/plan/", views.PlanTripView.as_view(), name="trip-plan"),
    path("trips/<uuid:pk>/", views.TripDetailView.as_view(), name="trip-detail"),
]
