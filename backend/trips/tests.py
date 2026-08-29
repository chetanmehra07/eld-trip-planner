from datetime import datetime, timedelta
from unittest import mock

from django.test import TestCase
from rest_framework.test import APIClient

from .services.hos_planner import (
    DRIVING,
    DRIVING_BEFORE_BREAK_MINUTES,
    DRIVING_WINDOW_MINUTES,
    MAX_DRIVING_MINUTES,
    HOSPlanner,
    Leg,
    Place,
)
from .services.logbook import build_daily_logs

ORIGIN = Place("Chicago, IL", 41.8781, -87.6298)
PICKUP = Place("Indianapolis, IN", 39.7684, -86.1581)
DROPOFF = Place("Nashville, TN", 36.1627, -86.7816)
START = datetime(2026, 8, 29, 8, 0)


def make_legs(miles_1: float, miles_2: float, mph: float = 55.0):
    return [
        Leg(0, ORIGIN, PICKUP, miles_1, miles_1 / mph * 60, [[ORIGIN.lat, ORIGIN.lng], [PICKUP.lat, PICKUP.lng]]),
        Leg(1, PICKUP, DROPOFF, miles_2, miles_2 / mph * 60, [[PICKUP.lat, PICKUP.lng], [DROPOFF.lat, DROPOFF.lng]]),
    ]


class PlannerTests(TestCase):
    def test_short_trip_needs_no_rest_or_fuel(self):
        segments = HOSPlanner(make_legs(180, 290), START, 10).plan()
        kinds = [s.kind for s in segments]
        self.assertEqual(kinds, ["off_duty", "drive", "pickup", "drive", "dropoff", "off_duty"])
        self.assertAlmostEqual(sum(s.miles for s in segments), 470, places=1)
        self.assertEqual([s.duration_minutes for s in segments if s.kind in ("pickup", "dropoff")], [60, 60])

    def test_long_trip_respects_every_hos_limit(self):
        segments = HOSPlanner(make_legs(1300, 1250), START, 0).plan()
        kinds = [s.kind for s in segments]
        self.assertEqual(kinds.count("fuel"), 2, "2,550 miles → fuel at 1,000 and 2,000 miles")
        self.assertIn("rest", kinds)
        self.assertIn("break", kinds)
        self.assertAlmostEqual(sum(s.miles for s in segments), 2550, places=1)

        drive_since_rest = drive_since_break = 0.0
        window_start = None
        previous_end = None
        for seg in segments:
            if previous_end is not None:
                self.assertEqual(seg.start, previous_end, "segments must be contiguous")
            previous_end = seg.end
            if seg.kind in ("rest", "restart"):
                drive_since_rest = drive_since_break = 0.0
                window_start = seg.end
            elif seg.kind == "drive":
                window_start = window_start or seg.start
                drive_since_rest += seg.duration_minutes
                drive_since_break += seg.duration_minutes
                self.assertLessEqual(drive_since_rest, MAX_DRIVING_MINUTES + 1)
                self.assertLessEqual(drive_since_break, DRIVING_BEFORE_BREAK_MINUTES + 1)
                self.assertLessEqual((seg.end - window_start).total_seconds() / 60, DRIVING_WINDOW_MINUTES + 1)
            elif seg.duration_minutes >= 30:
                drive_since_break = 0.0

    def test_cycle_limit_triggers_34_hour_restart(self):
        segments = HOSPlanner(make_legs(600, 600), START, 69.5).plan()
        kinds = [s.kind for s in segments]
        self.assertIn("restart", kinds)
        first_drive = next(s for s in segments if s.kind == "drive")
        self.assertLessEqual(first_drive.duration_minutes, 30)
        restart = next(s for s in segments if s.kind == "restart")
        self.assertEqual(restart.duration_minutes, 34 * 60)

    def test_exhausted_cycle_restarts_before_driving(self):
        segments = HOSPlanner(make_legs(100, 100), START, 70).plan()
        self.assertEqual([s.kind for s in segments][:2], ["off_duty", "restart"])

    def test_daily_logs_cover_24_hours_each(self):
        segments = HOSPlanner(make_legs(1300, 1250), START, 20).plan()
        logs = build_daily_logs(segments, cycle_used_hours=20)
        self.assertGreaterEqual(len(logs), 4)
        for log in logs:
            self.assertEqual(sum(log["totals"].values()), 1440)
            for part in log["segments"]:
                self.assertLessEqual(part["end_minute"], 1440)
                self.assertLess(part["start_minute"], part["end_minute"])
        self.assertAlmostEqual(sum(log["total_miles"] for log in logs), 2550, delta=1.5)
        # Prior cycle hours are carried into the recap of the first day.
        first_day_driving = logs[0]["totals"][DRIVING]
        self.assertGreaterEqual(logs[0]["recap"]["last_8_days"], first_day_driving + 20 * 60)
        self.assertEqual(logs[0]["recap"]["available_tomorrow"], 70 * 60 - logs[0]["recap"]["last_7_days"])


class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _payload(self):
        return {
            "current_location": {"name": ORIGIN.name, "lat": ORIGIN.lat, "lng": ORIGIN.lng},
            "pickup_location": {"name": PICKUP.name, "lat": PICKUP.lat, "lng": PICKUP.lng},
            "dropoff_location": {"name": DROPOFF.name, "lat": DROPOFF.lat, "lng": DROPOFF.lng},
            "current_cycle_used": 12,
            "start_time": "2026-08-29T06:00:00",
            "driver_name": "Test Driver",
        }

    @mock.patch("trips.views.resolve_place_names", lambda places: None)
    @mock.patch("trips.views.get_route", lambda places: make_legs(1300, 1250))
    def test_plan_and_fetch_trip(self):
        response = self.client.post("/api/trips/plan/", self._payload(), format="json")
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(body["summary"]["fuel_stops"], 2)
        self.assertEqual(len(body["daily_logs"]), body["summary"]["days"])
        self.assertEqual(body["daily_logs"][0]["date"], "2026-08-29")
        self.assertEqual(body["inputs"]["driver_name"], "Test Driver")

        detail = self.client.get(f"/api/trips/{body['id']}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["summary"], body["summary"])

        listing = self.client.get("/api/trips/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.json()[0]["id"], body["id"])

    def test_validation_errors(self):
        response = self.client.post("/api/trips/plan/", {"current_cycle_used": 80}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("current_location", response.json())
