"""
Routing providers.

* OSRM public demo server (default) – free, no API key.
* OpenRouteService (optional, `ROUTING_PROVIDER=ors` + `ORS_API_KEY`) – free tier,
  supports a heavy-goods-vehicle profile.

Each provider returns, per leg: distance, duration, a [lat, lng] polyline and
turn-by-turn instructions. Responses are cached.
"""

from __future__ import annotations

import hashlib
import logging
from typing import List

import requests
from django.conf import settings
from django.core.cache import cache

from .hos_planner import Leg, Place

log = logging.getLogger(__name__)

METERS_PER_MILE = 1609.344


class RoutingError(Exception):
    """Raised when a route cannot be computed."""


def get_route(places: List[Place]) -> List[Leg]:
    """Route through `places` in order and return one Leg per consecutive pair."""
    if len(places) < 2:
        raise RoutingError("At least two locations are required.")
    legs: List[Leg] = []
    for index, (origin, destination) in enumerate(zip(places, places[1:])):
        data = _cached_leg(origin, destination)
        distance_miles = data["distance_m"] / METERS_PER_MILE
        duration_minutes = data["duration_s"] / 60
        # OSRM estimates passenger-car speeds; never assume a truck averages more than the cap.
        duration_minutes = max(duration_minutes, distance_miles / settings.MAX_AVERAGE_SPEED_MPH * 60)
        legs.append(
            Leg(
                index=index,
                origin=origin,
                destination=destination,
                distance_miles=distance_miles,
                duration_minutes=duration_minutes,
                geometry=data["geometry"],
                steps=data["steps"],
            )
        )
    return legs


def _cached_leg(a: Place, b: Place) -> dict:
    raw = f"{settings.ROUTING_PROVIDER}:{a.lat:.5f},{a.lng:.5f}->{b.lat:.5f},{b.lng:.5f}"
    key = "route:" + hashlib.md5(raw.encode()).hexdigest()
    data = cache.get(key)
    if data is None:
        if settings.ROUTING_PROVIDER == "ors" and settings.ORS_API_KEY:
            data = _fetch_ors(a, b)
        else:
            data = _fetch_osrm(a, b)
        cache.set(key, data, 60 * 60 * 6)
    return data


# ---------------------------------------------------------------- OSRM
def _fetch_osrm(a: Place, b: Place) -> dict:
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{a.lng:.6f},{a.lat:.6f};{b.lng:.6f},{b.lat:.6f}"
    try:
        response = requests.get(
            url,
            params={"overview": "simplified", "geometries": "geojson", "steps": "true", "alternatives": "false"},
            headers={"User-Agent": settings.GEOCODER_USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        log.warning("OSRM request failed: %s", exc)
        raise RoutingError("The routing service (OSRM) is unavailable right now. Please try again in a moment.") from exc

    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise RoutingError(f"No drivable route was found between {a.name} and {b.name}.")

    route = payload["routes"][0]
    leg = route["legs"][0]
    geometry = [[round(lat, 5), round(lng, 5)] for lng, lat in route["geometry"]["coordinates"]]
    steps = [_format_osrm_step(step) for step in leg.get("steps", [])]
    return {"distance_m": route["distance"], "duration_s": route["duration"], "geometry": geometry, "steps": steps}


TURN_MODIFIERS = {"left", "right", "sharp left", "sharp right", "slight left", "slight right"}


def _format_osrm_step(step: dict) -> dict:
    maneuver = step.get("maneuver", {})
    kind = maneuver.get("type", "")
    modifier = maneuver.get("modifier") or ""
    name = step.get("name") or ""
    ref = step.get("ref") or ""
    if name and ref and ref not in name:
        road = f"{name} ({ref})"
    else:
        road = name or ref
    onto = f" onto {road}" if road else ""

    if kind == "depart":
        text = f"Head {modifier} on {road}" if road and modifier else (f"Head on {road}" if road else "Depart")
    elif kind == "arrive":
        side = f" (on the {modifier})" if modifier in ("left", "right") else ""
        text = f"Arrive at destination{side}"
    elif kind in ("turn", "end of road", "continue") and modifier in TURN_MODIFIERS:
        text = f"Turn {modifier}{onto}"
    elif kind in ("turn", "continue") and modifier.startswith("uturn"):
        text = f"Make a U-turn{onto}"
    elif kind in ("continue", "new name", "notification", "turn", "end of road"):
        text = f"Continue{onto}" if road else "Continue straight"
    elif kind == "merge":
        text = f"Merge {modifier}{onto}".replace("  ", " ")
    elif kind == "on ramp":
        text = f"Take the ramp{(' ' + modifier) if modifier else ''}{onto}"
    elif kind == "off ramp":
        side = f" on the {modifier}" if modifier in ("left", "right") else ""
        text = f"Take the exit{side}{(' toward ' + road) if road else ''}"
    elif kind == "fork":
        text = f"Keep {modifier}{onto}" if modifier else f"Continue at the fork{onto}"
    elif kind in ("roundabout", "rotary"):
        exit_no = maneuver.get("exit")
        text = f"Enter the roundabout and take exit {exit_no}{onto}" if exit_no else f"Enter the roundabout{onto}"
    elif kind in ("exit roundabout", "exit rotary"):
        text = f"Exit the roundabout{onto}"
    else:
        text = " ".join(part for part in (kind.capitalize(), modifier) if part) + onto
    return {
        "instruction": text.strip(),
        "distance_miles": round(step.get("distance", 0) / METERS_PER_MILE, 1),
        "duration_minutes": round(step.get("duration", 0) / 60),
        "type": kind,
    }


# ---------------------------------------------------------------- OpenRouteService
def _fetch_ors(a: Place, b: Place) -> dict:
    url = "https://api.openrouteservice.org/v2/directions/driving-hgv/geojson"
    try:
        response = requests.post(
            url,
            json={"coordinates": [[a.lng, a.lat], [b.lng, b.lat]], "instructions": True, "units": "m"},
            headers={"Authorization": settings.ORS_API_KEY, "Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        log.warning("OpenRouteService request failed: %s", exc)
        raise RoutingError("The routing service (OpenRouteService) is unavailable right now.") from exc

    features = payload.get("features") or []
    if not features:
        raise RoutingError(f"No drivable route was found between {a.name} and {b.name}.")
    feature = features[0]
    segment = feature["properties"]["segments"][0]
    geometry = [[round(lat, 5), round(lng, 5)] for lng, lat in feature["geometry"]["coordinates"]]
    steps = [
        {
            "instruction": step.get("instruction", ""),
            "distance_miles": round(step.get("distance", 0) / METERS_PER_MILE, 1),
            "duration_minutes": round(step.get("duration", 0) / 60),
            "type": str(step.get("type", "")),
        }
        for step in segment.get("steps", [])
    ]
    return {"distance_m": segment["distance"], "duration_s": segment["duration"], "geometry": geometry, "steps": steps}
