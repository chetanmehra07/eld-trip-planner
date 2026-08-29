from rest_framework import serializers

from .models import Trip


class LocationField(serializers.Field):
    """Accepts either a free-text address or an object {name, lat, lng}."""

    default_error_messages = {
        "invalid": "Provide an address string or an object with name, lat and lng.",
        "blank": "This field may not be blank.",
        "range": "Coordinates are out of range.",
    }

    def to_internal_value(self, data):
        if isinstance(data, str):
            value = data.strip()
            if not value:
                self.fail("blank")
            return {"name": value[:200]}
        if isinstance(data, dict):
            name = str(data.get("name") or data.get("address") or "").strip()
            lat = data.get("lat")
            lng = data.get("lng", data.get("lon"))
            if lat is not None and lng is not None:
                try:
                    lat, lng = float(lat), float(lng)
                except (TypeError, ValueError):
                    self.fail("invalid")
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    self.fail("range")
                return {"name": (name or f"{lat:.4f}, {lng:.4f}")[:200], "lat": lat, "lng": lng}
            if name:
                return {"name": name[:200]}
        self.fail("invalid")

    def to_representation(self, value):
        return value


class PlanTripRequestSerializer(serializers.Serializer):
    current_location = LocationField()
    pickup_location = LocationField()
    dropoff_location = LocationField()
    current_cycle_used = serializers.FloatField(min_value=0, max_value=70)
    start_time = serializers.DateTimeField(required=False, allow_null=True)
    driver_name = serializers.CharField(required=False, allow_blank=True, max_length=120, default="")
    carrier_name = serializers.CharField(required=False, allow_blank=True, max_length=120, default="")
    truck_number = serializers.CharField(required=False, allow_blank=True, max_length=120, default="")
    home_terminal = serializers.CharField(required=False, allow_blank=True, max_length=200, default="")


class TripListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            "id",
            "created_at",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "current_cycle_used",
            "start_time",
            "total_miles",
            "total_duration_minutes",
            "days",
        ]


def trip_to_dict(trip: Trip) -> dict:
    """Full plan payload: model metadata + the stored plan."""
    return {"id": str(trip.id), "created_at": trip.created_at.isoformat(timespec="seconds"), **trip.plan}
