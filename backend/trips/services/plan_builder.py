"""Assemble the JSON plan returned by the API (and stored on the Trip model)."""

from __future__ import annotations

from collections import Counter
from typing import List

from django.conf import settings

from .hos_planner import ASSUMPTIONS, OFF_DUTY, ON_DUTY, RULES, SLEEPER_BERTH, HOSPlanner, Leg, Segment


def build_plan(*, inputs: dict, legs: List[Leg], segments: List[Segment], logs: List[dict], planner: HOSPlanner) -> dict:
    events = [s for s in segments if s.kind != "off_duty"]
    drives = [s for s in events if s.kind == "drive"]
    stops = [s for s in events if s.kind != "drive"]

    total_miles = sum(leg.distance_miles for leg in legs)
    driving_minutes = sum(s.duration_minutes for s in drives)
    on_duty_not_driving = sum(s.duration_minutes for s in events if s.status == ON_DUTY)
    resting_minutes = sum(s.duration_minutes for s in events if s.status in (OFF_DUTY, SLEEPER_BERTH))
    kind_counts = Counter(s.kind for s in stops)
    start, end = events[0].start, events[-1].end
    cycle_used_at_end = planner.cycle_used_minutes()

    summary = {
        "total_miles": round(total_miles, 1),
        "driving_minutes": round(driving_minutes),
        "on_duty_minutes": round(driving_minutes + on_duty_not_driving),
        "resting_minutes": round(resting_minutes),
        "total_minutes": round((end - start).total_seconds() / 60),
        "start_time": start.isoformat(timespec="minutes"),
        "end_time": end.isoformat(timespec="minutes"),
        "days": len(logs),
        "fuel_stops": kind_counts.get("fuel", 0),
        "rest_breaks": kind_counts.get("break", 0),
        "ten_hour_rests": kind_counts.get("rest", 0),
        "restarts": kind_counts.get("restart", 0),
        "average_speed_mph": round(total_miles / (driving_minutes / 60), 1) if driving_minutes else 0,
        "cycle_hours_used_at_end": round(cycle_used_at_end / 60, 1),
        "cycle_hours_remaining_at_end": round(max(0.0, 70 - cycle_used_at_end / 60), 1),
    }

    coords = [pt for leg in legs for pt in leg.geometry]
    bounds = [
        [min(c[0] for c in coords), min(c[1] for c in coords)],
        [max(c[0] for c in coords), max(c[1] for c in coords)],
    ]
    route = {
        "provider": settings.ROUTING_PROVIDER,
        "bounds": bounds,
        "legs": [
            {
                "index": leg.index,
                "name": "To pickup" if leg.index == 0 else "To drop-off",
                "from": leg.origin.to_dict(),
                "to": leg.destination.to_dict(),
                "distance_miles": round(leg.distance_miles, 1),
                "duration_minutes": round(leg.duration_minutes),
                "geometry": leg.geometry,
                "steps": leg.steps,
            }
            for leg in legs
        ],
    }

    return {
        "inputs": inputs,
        "summary": summary,
        "route": route,
        "stops": [s.to_dict() for s in stops],
        "timeline": [s.to_dict() for s in segments],
        "daily_logs": logs,
        "assumptions": ASSUMPTIONS,
        "rules": RULES,
    }
