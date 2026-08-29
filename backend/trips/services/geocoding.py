"""
Geocoding built on free OpenStreetMap services.

* Forward geocoding (address → coordinates): Nominatim (max 1 request/second).
* Reverse geocoding (coordinates → "City, ST"): Photon (fast, no strict limit),
  with Nominatim as a fallback. Used to name fuel/rest stops along the route.

Results are cached so repeated trips do not hit the public services again.
"""

from __future__ import annotations

import hashlib
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Iterable, Optional

import requests
from django.conf import settings
from django.core.cache import cache

from .hos_planner import Place

log = logging.getLogger(__name__)


class GeocodingError(Exception):
    """Raised when a location cannot be resolved."""


US_STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
    "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL",
    "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA",
    "Maine": "ME", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
    "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR",
    "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD",
    "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
    "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
}
CA_PROVINCES = {
    "Alberta": "AB", "British Columbia": "BC", "Manitoba": "MB", "New Brunswick": "NB",
    "Newfoundland and Labrador": "NL", "Nova Scotia": "NS", "Ontario": "ON",
    "Prince Edward Island": "PE", "Quebec": "QC", "Québec": "QC", "Saskatchewan": "SK",
    "Northwest Territories": "NT", "Nunavut": "NU", "Yukon": "YT",
}
REGION_ABBR = {**US_STATES, **CA_PROVINCES}

_session = requests.Session()
_session.headers.update({"User-Agent": settings.GEOCODER_USER_AGENT, "Accept-Language": "en"})

_nominatim_lock = threading.Lock()
_last_nominatim_call = 0.0


def _throttle_nominatim() -> None:
    """Respect Nominatim's 1 request/second usage policy."""
    global _last_nominatim_call
    with _nominatim_lock:
        wait = 1.05 - (time.monotonic() - _last_nominatim_call)
        if wait > 0:
            time.sleep(wait)
        _last_nominatim_call = time.monotonic()


def short_place_name(address: dict, fallback: str = "") -> str:
    """Format an OSM address dict as 'City, ST' (US/CA) or 'City, Region, Country'."""
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("hamlet")
        or address.get("municipality")
        or address.get("county")
    )
    state = address.get("state")
    country_code = (address.get("country_code") or "").upper()
    parts = []
    if city:
        parts.append(city)
    if state:
        parts.append(REGION_ABBR.get(state, state) if country_code in ("US", "CA") else state)
    if country_code and country_code != "US" and address.get("country"):
        parts.append(address["country"])
    return ", ".join(parts) if parts else fallback


# ---------------------------------------------------------------- forward
def geocode(query: str) -> Place:
    q = " ".join(query.split())
    key = "geocode:" + hashlib.md5(q.lower().encode()).hexdigest()
    cached = cache.get(key)
    if cached:
        return Place(**cached)

    _throttle_nominatim()
    try:
        response = _session.get(
            f"{settings.NOMINATIM_BASE_URL}/search",
            params={"q": q, "format": "jsonv2", "limit": 1, "addressdetails": 1},
            timeout=12,
        )
        response.raise_for_status()
        results = response.json()
    except (requests.RequestException, ValueError) as exc:
        log.warning("Nominatim lookup failed for %r: %s", q, exc)
        raise GeocodingError(f'The geocoding service is unavailable while looking up "{q}". Please retry.') from exc

    if not results:
        raise GeocodingError(f'Could not find a location for "{q}". Try adding the city and state.')

    item = results[0]
    name = short_place_name(item.get("address", {}), fallback=q) or q
    place = Place(name=name, lat=float(item["lat"]), lng=float(item["lon"]))
    cache.set(key, place.to_dict(), 60 * 60 * 24)
    return place


# ---------------------------------------------------------------- reverse
def _photon_reverse(lat: float, lng: float) -> Optional[str]:
    try:
        response = _session.get(
            f"{settings.PHOTON_BASE_URL}/reverse",
            params={"lat": f"{lat:.5f}", "lon": f"{lng:.5f}", "lang": "en"},
            timeout=6,
        )
        response.raise_for_status()
        features = response.json().get("features") or []
    except (requests.RequestException, ValueError):
        return None
    if not features:
        return None
    props = features[0].get("properties", {})
    address = {
        "city": props.get("city") or props.get("town") or props.get("village") or props.get("county") or props.get("name"),
        "state": props.get("state"),
        "country": props.get("country"),
        "country_code": props.get("countrycode"),
    }
    return short_place_name(address) or None


def _nominatim_reverse(lat: float, lng: float) -> Optional[str]:
    _throttle_nominatim()
    try:
        response = _session.get(
            f"{settings.NOMINATIM_BASE_URL}/reverse",
            params={"lat": f"{lat:.5f}", "lon": f"{lng:.5f}", "format": "jsonv2", "zoom": 10, "addressdetails": 1},
            timeout=8,
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError):
        return None
    return short_place_name(data.get("address", {})) or None


def reverse_geocode(lat: float, lng: float) -> str:
    key = f"revgeo:{lat:.3f}:{lng:.3f}"
    cached = cache.get(key)
    if cached:
        return cached
    name = _photon_reverse(lat, lng) or _nominatim_reverse(lat, lng) or f"{lat:.3f}, {lng:.3f}"
    cache.set(key, name, 60 * 60 * 24)
    return name


def resolve_place_names(places: Iterable[Place], max_workers: int = 6) -> None:
    """Fill in `name` for every unnamed Place, in parallel."""
    todo = [p for p in places if not p.name]
    if not todo:
        return
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        names = list(pool.map(lambda p: reverse_geocode(p.lat, p.lng), todo))
    for place, name in zip(todo, names):
        place.name = name
