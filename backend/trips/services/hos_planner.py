"""
Hours-of-Service planner for property-carrying drivers (49 CFR §395.3).

Rules implemented
-----------------
* 11-hour driving limit after 10 consecutive hours off duty.
* 14-hour driving window (off-duty time does *not* extend it).
* 30-minute break after 8 cumulative hours of driving (any 30 consecutive
  non-driving minutes qualify: off duty, sleeper berth or on duty not driving).
* 70-hour / 8-day on-duty limit, reset by a 34-hour restart.

Assessment assumptions
----------------------
* Fuel stop at least every 1,000 miles (30 min, on duty not driving).
* 1 hour on duty (not driving) for pickup and 1 hour for drop-off.
* No adverse driving conditions; the driver starts the trip after a
  qualifying 10-hour off-duty period; previously used cycle hours are counted
  as of the trip start day (conservative).

The planner simulates the trip in (float) minutes and emits a list of
contiguous `Segment`s. Splitting into 24-hour log sheets lives in logbook.py.
"""

from __future__ import annotations

import bisect
import math
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Dict, Iterator, List, Optional, Tuple

# ---------------------------------------------------------------- FMCSA limits
MAX_DRIVING_MINUTES = 11 * 60
DRIVING_WINDOW_MINUTES = 14 * 60
DRIVING_BEFORE_BREAK_MINUTES = 8 * 60
BREAK_MINUTES = 30
REST_MINUTES = 10 * 60
CYCLE_LIMIT_MINUTES = 70 * 60
CYCLE_DAYS = 8
RESTART_MINUTES = 34 * 60

# ---------------------------------------------------------------- assumptions
FUEL_INTERVAL_MILES = 1000.0
FUEL_STOP_MINUTES = 30
PICKUP_MINUTES = 60
DROPOFF_MINUTES = 60

# ---------------------------------------------------------------- duty statuses
OFF_DUTY = "off_duty"
SLEEPER_BERTH = "sleeper_berth"
DRIVING = "driving"
ON_DUTY = "on_duty"
STATUS_ORDER = [OFF_DUTY, SLEEPER_BERTH, DRIVING, ON_DUTY]
STATUS_LABELS = {
    OFF_DUTY: "Off duty",
    SLEEPER_BERTH: "Sleeper berth",
    DRIVING: "Driving",
    ON_DUTY: "On duty (not driving)",
}

# Short labels used in the "Remarks" section of the paper log.
KIND_REMARK = {
    "drive": "Driving",
    "pickup": "Pickup",
    "dropoff": "Drop-off",
    "fuel": "Fuel",
    "break": "30-min break",
    "rest": "10-hr rest",
    "restart": "34-hr restart",
    "off_duty": "Off duty",
}

LIMIT_EPS = 0.5  # minutes: a limit with less than this left is treated as exhausted
MILE_EPS = 0.01

RULES = {
    "max_driving_hours": MAX_DRIVING_MINUTES / 60,
    "driving_window_hours": DRIVING_WINDOW_MINUTES / 60,
    "break_after_driving_hours": DRIVING_BEFORE_BREAK_MINUTES / 60,
    "break_minutes": BREAK_MINUTES,
    "rest_hours": REST_MINUTES / 60,
    "cycle_limit_hours": CYCLE_LIMIT_MINUTES / 60,
    "cycle_days": CYCLE_DAYS,
    "restart_hours": RESTART_MINUTES / 60,
    "fuel_interval_miles": FUEL_INTERVAL_MILES,
    "fuel_stop_minutes": FUEL_STOP_MINUTES,
    "pickup_minutes": PICKUP_MINUTES,
    "dropoff_minutes": DROPOFF_MINUTES,
}

ASSUMPTIONS = [
    "Property-carrying driver on the 70-hour / 8-day cycle, no adverse driving conditions.",
    "Driver begins the trip after a qualifying 10-hour off-duty period.",
    "Hours already used in the cycle are counted as of the trip start day (conservative).",
    "Fuel stop (30 min, on duty) at least every 1,000 miles.",
    "1 hour on duty (not driving) for pickup and 1 hour for drop-off.",
    "10-hour rests are logged as sleeper berth; 30-minute breaks and 34-hour restarts as off duty.",
    "Average speed never exceeds 60 mph (OSRM car estimates are capped to truck speeds).",
]


# ================================================================ data model
@dataclass
class Place:
    name: str
    lat: float
    lng: float

    def to_dict(self) -> dict:
        return {"name": self.name, "lat": round(self.lat, 6), "lng": round(self.lng, 6)}


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 3958.7613
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@dataclass
class Leg:
    """One routed leg (origin → destination) with its polyline geometry."""

    index: int
    origin: Place
    destination: Place
    distance_miles: float
    duration_minutes: float
    geometry: List[List[float]]  # [[lat, lng], ...]
    steps: List[dict] = field(default_factory=list)
    _cumulative: List[float] = field(default_factory=list, repr=False)

    def __post_init__(self) -> None:
        if len(self.geometry) < 2:
            self.geometry = [
                [self.origin.lat, self.origin.lng],
                [self.destination.lat, self.destination.lng],
            ]
        cum = [0.0]
        for a, b in zip(self.geometry, self.geometry[1:]):
            cum.append(cum[-1] + haversine_miles(a[0], a[1], b[0], b[1]))
        self._cumulative = cum

    @property
    def average_speed_mph(self) -> float:
        return self.distance_miles / (self.duration_minutes / 60) if self.duration_minutes else 0.0

    def point_at(self, fraction: float) -> Tuple[float, float]:
        """Coordinates `fraction` (0..1) of the way along the leg's polyline."""
        fraction = min(max(fraction, 0.0), 1.0)
        total = self._cumulative[-1]
        if total <= 0:
            return self.geometry[0][0], self.geometry[0][1]
        target = fraction * total
        i = max(1, bisect.bisect_left(self._cumulative, target))
        i = min(i, len(self._cumulative) - 1)
        d0, d1 = self._cumulative[i - 1], self._cumulative[i]
        t = 0.0 if d1 == d0 else (target - d0) / (d1 - d0)
        (lat0, lng0), (lat1, lng1) = self.geometry[i - 1], self.geometry[i]
        return lat0 + (lat1 - lat0) * t, lng0 + (lng1 - lng0) * t


@dataclass
class Segment:
    """A contiguous block of time in a single duty status."""

    kind: str  # drive | pickup | dropoff | fuel | break | rest | restart | off_duty
    status: str
    start: datetime
    end: datetime
    label: str
    location: Place
    end_location: Optional[Place] = None  # only for drives
    miles: float = 0.0
    odometer_start: float = 0.0
    odometer_end: float = 0.0
    leg_index: Optional[int] = None
    note: str = ""

    @property
    def duration_minutes(self) -> float:
        return (self.end - self.start).total_seconds() / 60

    def to_dict(self) -> dict:
        data = {
            "kind": self.kind,
            "status": self.status,
            "status_label": STATUS_LABELS[self.status],
            "label": self.label,
            "note": self.note,
            "start": self.start.isoformat(timespec="minutes"),
            "end": self.end.isoformat(timespec="minutes"),
            "duration_minutes": round(self.duration_minutes),
            "location": self.location.to_dict(),
            "miles": round(self.miles, 1),
            "odometer_start": round(self.odometer_start, 1),
            "odometer_end": round(self.odometer_end, 1),
            "leg_index": self.leg_index,
        }
        if self.end_location is not None:
            data["end_location"] = self.end_location.to_dict()
        return data


# ================================================================ helpers
def split_minutes_by_day(start: datetime, end: datetime) -> Iterator[Tuple[date, float]]:
    """Yield (date, minutes) for the portion of [start, end) falling on each calendar day."""
    cursor = start
    while cursor < end:
        day_end = datetime.combine(cursor.date(), time.min) + timedelta(days=1)
        chunk_end = min(day_end, end)
        yield cursor.date(), (chunk_end - cursor).total_seconds() / 60
        cursor = chunk_end


def round_to_minute(dt: datetime) -> datetime:
    return (dt + timedelta(seconds=30)).replace(second=0, microsecond=0)


def unnamed_places(segments: List[Segment]) -> List[Place]:
    """Distinct Place objects that still need a human-readable name (reverse geocoding)."""
    seen: set[int] = set()
    out: List[Place] = []
    for seg in segments:
        for place in (seg.location, seg.end_location):
            if place is not None and not place.name and id(place) not in seen:
                seen.add(id(place))
                out.append(place)
    return out


# ================================================================ planner
class HOSPlanner:
    def __init__(self, legs: List[Leg], start_time: datetime, cycle_used_hours: float = 0.0):
        if not legs:
            raise ValueError("At least one leg is required")
        self.legs = legs
        self.now = start_time
        self.trip_start = start_time
        self.cycle_used_hours = cycle_used_hours

        # On-duty minutes per calendar day (rolling 8-day cycle). Prior hours are
        # booked on the start day so they stay inside the window for the whole trip.
        self.ledger: Dict[date, float] = defaultdict(float)
        if cycle_used_hours > 0:
            self.ledger[start_time.date()] += cycle_used_hours * 60

        self.drive_since_rest = 0.0  # → 11-hour limit
        self.drive_since_break = 0.0  # → 30-minute break rule
        self.window_start = start_time  # → 14-hour window
        self.miles_since_fuel = 0.0
        self.odometer = 0.0
        self.current_place: Place = legs[0].origin
        self.segments: List[Segment] = []
        self._place_cache: Dict[Tuple[float, float], Place] = {}

    # ------------------------------------------------------------ limits
    def cycle_used_minutes(self, on: Optional[date] = None) -> float:
        today = on or self.now.date()
        window_start = today - timedelta(days=CYCLE_DAYS - 1)
        return sum(m for d, m in self.ledger.items() if window_start <= d <= today)

    def _cycle_left(self) -> float:
        return CYCLE_LIMIT_MINUTES - self.cycle_used_minutes()

    def _drive_left(self) -> float:
        return MAX_DRIVING_MINUTES - self.drive_since_rest

    def _window_left(self) -> float:
        return DRIVING_WINDOW_MINUTES - (self.now - self.window_start).total_seconds() / 60

    def _break_left(self) -> float:
        return DRIVING_BEFORE_BREAK_MINUTES - self.drive_since_break

    # ------------------------------------------------------------ bookkeeping
    def _advance(self, minutes: float, on_duty: bool) -> Tuple[datetime, datetime]:
        start = self.now
        end = start + timedelta(minutes=minutes)
        if on_duty:
            for day, mins in split_minutes_by_day(start, end):
                self.ledger[day] += mins
        self.now = end
        return start, end

    def _emit(
        self,
        kind: str,
        status: str,
        minutes: float,
        label: str,
        location: Place,
        *,
        on_duty: bool,
        note: str = "",
        end_location: Optional[Place] = None,
        miles: float = 0.0,
        leg_index: Optional[int] = None,
    ) -> Segment:
        start, end = self._advance(minutes, on_duty)
        seg = Segment(
            kind=kind,
            status=status,
            start=start,
            end=end,
            label=label,
            location=location,
            end_location=end_location,
            miles=miles,
            odometer_start=self.odometer,
            odometer_end=self.odometer + miles,
            leg_index=leg_index,
            note=note,
        )
        self.odometer += miles
        self.segments.append(seg)
        return seg

    def _place_on_leg(self, leg: Leg, fraction: float) -> Place:
        lat, lng = leg.point_at(fraction)
        key = (round(lat, 4), round(lng, 4))
        if key not in self._place_cache:
            self._place_cache[key] = Place(name="", lat=lat, lng=lng)  # named later (reverse geocoding)
        return self._place_cache[key]

    def _reset_after_rest(self) -> None:
        self.drive_since_rest = 0.0
        self.drive_since_break = 0.0
        self.window_start = self.now

    # ------------------------------------------------------------ stops
    def _take_fuel(self) -> None:
        self._emit(
            "fuel", ON_DUTY, FUEL_STOP_MINUTES, "Fuel stop", self.current_place,
            on_duty=True, note="Refuel – required at least every 1,000 miles",
        )
        self.miles_since_fuel = 0.0
        self.drive_since_break = 0.0  # 30 consecutive non-driving minutes satisfy the break rule

    def _take_break(self) -> None:
        self._emit(
            "break", OFF_DUTY, BREAK_MINUTES, "30-minute rest break", self.current_place,
            on_duty=False, note="Required after 8 cumulative hours of driving",
        )
        self.drive_since_break = 0.0

    def _take_rest(self) -> None:
        self._emit(
            "rest", SLEEPER_BERTH, REST_MINUTES, "10-hour rest (sleeper berth)", self.current_place,
            on_duty=False, note="Resets the 11-hour driving limit and 14-hour window",
        )
        self._reset_after_rest()

    def _take_restart(self) -> None:
        self._emit(
            "restart", OFF_DUTY, RESTART_MINUTES, "34-hour restart", self.current_place,
            on_duty=False, note="70-hour / 8-day limit reached – restart resets the cycle",
        )
        self.ledger.clear()
        self._reset_after_rest()

    def _on_duty_task(self, kind: str, minutes: float, label: str, note: str) -> None:
        self._emit(kind, ON_DUTY, minutes, label, self.current_place, on_duty=True, note=note)
        self.drive_since_break = 0.0  # 60 non-driving minutes also satisfy the break rule

    # ------------------------------------------------------------ driving
    def _drive_leg(self, leg: Leg, target: str) -> None:
        remaining = leg.distance_miles
        speed = leg.average_speed_mph or 55.0
        driven = 0.0

        while remaining > MILE_EPS:
            # 1) Enforce every limit *before* driving. Order matters: a restart
            #    covers everything; fueling (on duty) also satisfies the break rule.
            if self._cycle_left() <= LIMIT_EPS:
                self._take_restart()
                continue
            if self.miles_since_fuel >= FUEL_INTERVAL_MILES - MILE_EPS:
                self._take_fuel()
                continue
            if self._drive_left() <= LIMIT_EPS or self._window_left() <= LIMIT_EPS:
                self._take_rest()
                continue
            if self._break_left() <= LIMIT_EPS:
                # A break that would leave no usable driving window is pointless – sleep instead.
                if self._window_left() <= BREAK_MINUTES + LIMIT_EPS:
                    self._take_rest()
                else:
                    self._take_break()
                continue

            # 2) Drive as far as the tightest limit allows.
            minutes_to_finish = remaining / speed * 60
            minutes_to_fuel = (FUEL_INTERVAL_MILES - self.miles_since_fuel) / speed * 60
            allowed = min(
                minutes_to_finish,
                minutes_to_fuel,
                self._drive_left(),
                self._window_left(),
                self._break_left(),
                self._cycle_left(),
            )
            if allowed >= minutes_to_finish - 1e-9:
                minutes, miles = minutes_to_finish, remaining
                end_place = leg.destination
            else:
                minutes = allowed
                miles = allowed / 60 * speed
                end_place = self._place_on_leg(leg, (driven + miles) / leg.distance_miles)

            self._emit(
                "drive", DRIVING, minutes, f"Drive toward {leg.destination.name}", self.current_place,
                on_duty=True, note=f"Leg {leg.index + 1} · to {target}",
                end_location=end_place, miles=miles, leg_index=leg.index,
            )
            self.drive_since_rest += minutes
            self.drive_since_break += minutes
            self.miles_since_fuel += miles
            driven += miles
            remaining -= miles
            self.current_place = end_place

    # ------------------------------------------------------------ public API
    def plan(self) -> List[Segment]:
        last = len(self.legs) - 1
        for leg in self.legs:
            is_last = leg.index == last
            self._drive_leg(leg, "drop-off" if is_last else "pickup")
            if is_last:
                self._on_duty_task("dropoff", DROPOFF_MINUTES, "Drop-off – unloading", "1 hour on duty (not driving)")
            else:
                self._on_duty_task("pickup", PICKUP_MINUTES, "Pickup – loading", "1 hour on duty (not driving)")
        self._round_segments()
        self._add_off_duty_padding()
        return self.segments

    def _round_segments(self) -> None:
        """Snap segment boundaries to whole minutes (neighbours share instants, so they stay contiguous)."""
        for seg in self.segments:
            seg.start = round_to_minute(seg.start)
            seg.end = round_to_minute(seg.end)
        self.segments = [s for s in self.segments if s.end > s.start]
        self.now = self.segments[-1].end if self.segments else round_to_minute(self.now)

    def _add_off_duty_padding(self) -> None:
        """Off-duty time before the trip starts and after the delivery, so each log covers 24 hours."""
        if not self.segments:
            return
        first = self.segments[0]
        day_start = datetime.combine(first.start.date(), time.min)
        if first.start > day_start:
            self.segments.insert(
                0,
                Segment(
                    kind="off_duty", status=OFF_DUTY, start=day_start, end=first.start,
                    label="Off duty", location=first.location, note="Before trip start",
                ),
            )
        last = self.segments[-1]
        last_day = (last.end - timedelta(minutes=1)).date()
        day_end = datetime.combine(last_day, time.min) + timedelta(days=1)
        if last.end < day_end:
            self.segments.append(
                Segment(
                    kind="off_duty", status=OFF_DUTY, start=last.end, end=day_end,
                    label="Off duty", location=last.end_location or last.location, note="After delivery",
                )
            )
