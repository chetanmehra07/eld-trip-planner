from django.contrib import admin

from .models import Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "route_summary", "total_miles", "days", "current_cycle_used")
    readonly_fields = ("id", "created_at", "plan")
    ordering = ("-created_at",)

    @admin.display(description="Route")
    def route_summary(self, obj):
        return str(obj)
