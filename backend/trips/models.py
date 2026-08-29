import uuid

from django.db import models


class Trip(models.Model):
    """A planned trip: the raw inputs plus the full computed plan (route, stops, daily logs)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Inputs
    current_location = models.JSONField(help_text="{name, lat, lng}")
    pickup_location = models.JSONField()
    dropoff_location = models.JSONField()
    current_cycle_used = models.FloatField(default=0, help_text="On-duty hours already used in the 70hr/8day cycle")
    start_time = models.DateTimeField(help_text="Trip start in home-terminal time")
    driver_name = models.CharField(max_length=120, blank=True)
    carrier_name = models.CharField(max_length=120, blank=True)
    truck_number = models.CharField(max_length=120, blank=True)
    home_terminal = models.CharField(max_length=200, blank=True)

    # Denormalised summary (handy for listings / admin)
    total_miles = models.FloatField(default=0)
    total_duration_minutes = models.FloatField(default=0)
    days = models.PositiveIntegerField(default=1)

    # Full computed output (summary, route geometry, stops, timeline, daily logs)
    plan = models.JSONField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return (
            f"{self.current_location.get('name')} → {self.pickup_location.get('name')} "
            f"→ {self.dropoff_location.get('name')}"
        )
