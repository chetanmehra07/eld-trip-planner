import logging
from datetime import datetime

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Trip
from .serializers import PlanTripRequestSerializer, TripListSerializer, trip_to_dict
from .services.geocoding import GeocodingError, geocode, resolve_place_names
from .services.hos_planner import HOSPlanner, Place, unnamed_places
from .services.logbook import build_daily_logs
from .services.plan_builder import build_plan
from .services.routing import RoutingError, get_route

log = logging.getLogger(__name__)


def _to_place(location: dict) -> Place:
    if "lat" in location and "lng" in location:
        return Place(name=location["name"], lat=location["lat"], lng=location["lng"])
    return geocode(location["name"])


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class PlanTripView(APIView):
    """POST /api/trips/plan/ – route the trip, simulate HOS and generate daily logs."""

    def post(self, request):
        serializer = PlanTripRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        start_time = data.get("start_time") or datetime.now()
        start_time = start_time.replace(second=0, microsecond=0, tzinfo=None)

        try:
            places = [_to_place(data[key]) for key in ("current_location", "pickup_location", "dropoff_location")]
        except GeocodingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            legs = get_route(places)
        except RoutingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        planner = HOSPlanner(legs, start_time, data["current_cycle_used"])
        segments = planner.plan()
        resolve_place_names(unnamed_places(segments))  # name fuel/rest stops ("City, ST")
        logs = build_daily_logs(segments, cycle_used_hours=data["current_cycle_used"])

        inputs = {
            "current_location": places[0].to_dict(),
            "pickup_location": places[1].to_dict(),
            "dropoff_location": places[2].to_dict(),
            "current_cycle_used": data["current_cycle_used"],
            "start_time": start_time.isoformat(timespec="minutes"),
            "driver_name": data.get("driver_name", ""),
            "carrier_name": data.get("carrier_name", ""),
            "truck_number": data.get("truck_number", ""),
            "home_terminal": data.get("home_terminal", ""),
        }
        plan = build_plan(inputs=inputs, legs=legs, segments=segments, logs=logs, planner=planner)

        trip = Trip.objects.create(
            current_location=inputs["current_location"],
            pickup_location=inputs["pickup_location"],
            dropoff_location=inputs["dropoff_location"],
            current_cycle_used=data["current_cycle_used"],
            start_time=start_time,
            driver_name=inputs["driver_name"],
            carrier_name=inputs["carrier_name"],
            truck_number=inputs["truck_number"],
            home_terminal=inputs["home_terminal"],
            total_miles=plan["summary"]["total_miles"],
            total_duration_minutes=plan["summary"]["total_minutes"],
            days=plan["summary"]["days"],
            plan=plan,
        )
        return Response(trip_to_dict(trip), status=status.HTTP_201_CREATED)


class TripDetailView(APIView):
    """GET /api/trips/<uuid>/ – a previously planned trip (shareable link)."""

    def get(self, request, pk):
        trip = get_object_or_404(Trip, pk=pk)
        return Response(trip_to_dict(trip))


class TripListView(APIView):
    """GET /api/trips/ – the most recent trips."""

    def get(self, request):
        trips = Trip.objects.all()[:8]
        return Response(TripListSerializer(trips, many=True).data)
