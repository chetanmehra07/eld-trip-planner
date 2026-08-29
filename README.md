# ELD Trip Planner

A full-stack app that plans a property-carrying truck trip under the FMCSA **Hours of Service** rules and produces
everything a driver would need: the route on a map with every fuel stop, rest break, 10-hour rest and 34-hour restart, a
day-by-day itinerary, and **filled-in Driver's Daily Log sheets** drawn exactly like the paper form (duty-status graph
line, remarks, totals and the 70 hr / 8 day recap).

| Layer    | Stack                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Backend  | Python 3.12 · Django 5 · Django REST Framework · SQLite (Postgres-ready)       |
| Frontend | React 18 · Vite · Material UI 6 · React-Leaflet                               |
| Maps     | OSRM routing, Nominatim + Photon geocoding, CARTO/OSM tiles — all free, no key |
| Extras   | Django cache (LocMem / Redis) · Docker · Render + Vercel configs               |

## Features

- **Inputs:** current location, pickup location, drop-off location, current cycle used (hrs). Optional: start time,
  driver, carrier, truck/trailer, home terminal (printed on the logs).
- **Route map:** leg 1 to the pickup, leg 2 to the drop-off, numbered markers for every intermediate stop, popups with
  time, duration and odometer, turn-by-turn directions.
- **HOS-compliant schedule:** 11-hour driving limit, 14-hour driving window, 30-minute break after 8 hours of driving,
  70 hr / 8 day cycle with a 34-hour restart, fuel at least every 1,000 miles, 1 hour on duty for pickup and drop-off.
- **Daily log sheets:** one sheet per calendar day, rendered as SVG (crisp at any size) with the stepped blue-ink
  duty-status line, per-row totals (always 24:00), remarks at each change of duty status ("City, ST – activity"),
  shipping documents, and the recap (A/B/C boxes) that carries the prior cycle hours and honours restarts.
  Each sheet downloads as a PNG.
- **Shareable trips:** every plan is stored and reachable at `?trip=<id>`; the sidebar lists recent trips.
- **Address autocomplete** (Photon/OpenStreetMap) with free-text fallback (the API geocodes it).

## How the planner works

`backend/trips/services/hos_planner.py` simulates the trip in minutes:

1. The route is fetched once per leg from OSRM. Driving time is `max(OSRM duration, miles ÷ 60 mph)` so a truck is never
   assumed to average more than 60 mph.
2. Before every driving chunk the planner checks, in order:
   - **cycle** exhausted (70 hrs on duty in 8 days, counting the hours entered as *current cycle used*) → 34-hour restart
   - **fuel** due (≥ 1,000 miles since last fill) → 30-minute on-duty fuel stop
   - **11-hour driving limit** or **14-hour window** reached → 10-hour sleeper-berth rest (resets both, and the break clock)
   - **8 hours of driving** since the last 30-minute pause → 30-minute off-duty break
3. It then drives until the next of: leg end, fuel due, 11-hour limit, 14-hour window, 8-hour break clock or cycle limit,
   placing the stop at the correct point along the route polyline.
4. Pickup and drop-off add 1 hour on duty each (on-duty work always counts toward the cycle but is never blocked by the
   driving limits, matching the regulations).
5. `logbook.py` splits the timeline at midnight into 24-hour sheets, computes totals, remarks and the rolling 8-day recap.
6. Stops are reverse-geocoded in parallel so remarks read "Amarillo, TX – Fuel" instead of coordinates.

Assumptions are those from the assessment: property-carrying driver, 70 hrs / 8 days, no adverse driving conditions,
fueling at least once every 1,000 miles, 1 hour for pickup and 1 hour for drop-off. The 60 hr / 7 day boxes on the
log are marked N/A.

## Project structure

```
eld-trip-planner/
├── backend/
│   ├── config/                 Django project (settings, urls, wsgi/asgi)
│   ├── trips/
│   │   ├── models.py           Trip (UUID id, inputs, summary columns, full plan JSON)
│   │   ├── serializers.py      request validation (address string or {name, lat, lng})
│   │   ├── views.py            API endpoints
│   │   ├── tests.py            planner + API tests
│   │   └── services/
│   │       ├── hos_planner.py  HOS simulation → timeline segments
│   │       ├── logbook.py      timeline → daily log sheets (totals, remarks, recap)
│   │       ├── routing.py      OSRM / OpenRouteService client, turn-by-turn text
│   │       ├── geocoding.py    Nominatim forward + Photon reverse geocoding (cached)
│   │       └── plan_builder.py assembles the API response
│   ├── Dockerfile · render.yaml · vercel.json · requirements.txt · .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx             layout, state, loading/error handling, ?trip= links
│   │   ├── theme.js            MUI theme (navy/amber, IBM Plex)
│   │   ├── api/client.js       axios client + Photon autocomplete
│   │   ├── utils/format.js     formatting helpers, colour maps
│   │   └── components/
│   │       ├── TripForm.jsx · LocationAutocomplete.jsx
│   │       ├── SummaryCards.jsx · RouteMap.jsx · Itinerary.jsx · Directions.jsx
│   │       ├── DailyLogs.jsx   day tabs, PNG download, remarks table
│   │       ├── LogSheet.jsx    the SVG daily log sheet
│   │       └── Header.jsx · EmptyState.jsx · RecentTrips.jsx · SectionTitle.jsx
│   ├── vite.config.js · vercel.json · package.json · .env.example
├── docker-compose.yml
└── README.md
```

## Local setup

Prerequisites: Python 3.11+ and Node 18+ (Node 20 recommended). No API keys are required.

### 1. Backend (Django API on http://localhost:8000)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # optional – defaults work out of the box
python manage.py migrate
python manage.py runserver
```

Check it: <http://localhost:8000/api/health/> → `{"status": "ok"}`. The browsable API lives at `/api/trips/plan/`.

### 2. Frontend (Vite dev server on http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

The dev server proxies `/api/*` to `http://localhost:8000`, so no `.env` is needed locally. Open
<http://localhost:5173>, click an example chip (e.g. *Dallas → Denver → Seattle*) and press **Plan trip & generate logs**.

### 3. Run the tests

```bash
cd backend
python manage.py test
```

The tests cover the HOS engine (11/14/8-hour limits, fuel every 1,000 miles, 34-hour restart, contiguous timeline,
24-hour log totals, recap arithmetic) and the API (mocked routing).

### Docker (optional)

```bash
docker compose up --build
```

Starts the API (with Redis as the shared cache) on :8000 and the Vite dev server on :5173.

## Environment variables

### Backend (`backend/.env`)

| Variable                | Default                              | Purpose                                                        |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------- |
| `DJANGO_SECRET_KEY`     | insecure dev key                     | **Set in production**                                           |
| `DJANGO_DEBUG`          | `1`                                  | `0` in production                                               |
| `DJANGO_ALLOWED_HOSTS`  | `*`                                  | comma-separated hosts, e.g. `.onrender.com`                     |
| `CORS_ALLOWED_ORIGINS`  | allow all                            | e.g. `https://your-app.vercel.app`                              |
| `CSRF_TRUSTED_ORIGINS`  | –                                    | needed only for the admin behind HTTPS                          |
| `DATABASE_URL`          | SQLite `backend/db.sqlite3`          | `postgres://…` in production                                    |
| `REDIS_URL`             | – (LocMem cache)                     | `redis://host:6379/1` to share the route/geocode cache          |
| `ROUTING_PROVIDER`      | `osrm`                               | `ors` to use OpenRouteService's truck (`driving-hgv`) profile   |
| `ORS_API_KEY`           | –                                    | required when `ROUTING_PROVIDER=ors`                            |
| `OSRM_BASE_URL`         | `https://router.project-osrm.org`    | point at a self-hosted OSRM if desired                          |
| `GEOCODER_USER_AGENT`   | `eld-trip-planner/1.0 (contact)`     | Nominatim policy requires an identifying UA – add your email    |
| `MAX_AVERAGE_SPEED_MPH` | `60`                                 | cap used when converting distance to driving time               |

### Frontend (`frontend/.env`)

| Variable       | Default            | Purpose                                                          |
| -------------- | ------------------ | ---------------------------------------------------------------- |
| `VITE_API_URL` | `` (same origin)   | API origin in production, e.g. `https://eld-api.onrender.com`    |

## API

### `POST /api/trips/plan/`

```json
{
  "current_location": "Dallas, TX",
  "pickup_location": { "name": "Denver, CO", "lat": 39.7392, "lng": -104.9903 },
  "dropoff_location": "Seattle, WA",
  "current_cycle_used": 20,
  "start_time": "2026-08-29T06:00:00",
  "driver_name": "J. Martinez",
  "carrier_name": "Lone Star Freight LLC",
  "truck_number": "TRK 4471 / TRL 9082",
  "home_terminal": "2200 Industrial Blvd, Dallas, TX"
}
```

Locations accept a free-text address (geocoded server-side) or an object with coordinates. `start_time` is optional
(defaults to now) and is interpreted as home-terminal local time. Response (`201 Created`, abridged):

```json
{
  "id": "0f4c…",
  "inputs": { "...": "resolved locations with lat/lng and the driver details" },
  "summary": {
    "total_miles": 2115.0, "driving_minutes": 2188, "on_duty_minutes": 2368,
    "start_time": "2026-08-29T06:00", "end_time": "2026-09-01T04:28", "days": 4,
    "fuel_stops": 2, "rest_breaks": 2, "ten_hour_rests": 3, "restarts": 0,
    "cycle_hours_used_at_end": 59.5, "cycle_hours_remaining_at_end": 10.5
  },
  "route":  { "provider": "osrm", "bounds": [[…],[…]], "legs": [ { "from": {}, "to": {}, "distance_miles": 0, "duration_minutes": 0, "geometry": [[lat, lng]], "steps": [ { "instruction": "…" } ] } ] },
  "stops":  [ { "kind": "fuel", "status": "on_duty", "label": "Fuel stop", "start": "…", "end": "…", "location": { "name": "Amarillo, TX", "lat": 0, "lng": 0 }, "odometer_start": 1000.0 } ],
  "timeline": [ "every segment, including driving and off-duty padding" ],
  "daily_logs": [
    {
      "date": "2026-08-29", "day_index": 1, "weekday": "Saturday", "from": "Dallas, TX", "to": "Amarillo, TX",
      "total_miles": 638.0,
      "segments": [ { "status": "driving", "start_minute": 360, "end_minute": 840, "location": "Dallas, TX", "miles": 464.0 } ],
      "totals": { "off_duty": 390, "sleeper_berth": 390, "driving": 660, "on_duty": 0 },
      "remarks": [ { "minute": 360, "time": "06:00", "location": "Dallas, TX", "label": "Driving", "note": "Driving" } ],
      "recap": { "on_duty_today": 660, "last_7_days": 1860, "available_tomorrow": 2340, "last_8_days": 1860, "restart_completed": false }
    }
  ],
  "assumptions": ["…"],
  "rules": { "max_driving_hours": 11, "driving_window_hours": 14, "...": "…" }
}
```

Validation problems return `400` with field errors; geocoding/routing failures return `400 {"detail": "…"}`.

| Endpoint                 | Description                             |
| ------------------------ | --------------------------------------- |
| `GET /api/health/`       | liveness check                          |
| `GET /api/trips/`        | the most recent trips (for the sidebar) |
| `GET /api/trips/<uuid>/` | a stored plan (shareable link)          |
| `/admin/`                | Django admin (create a superuser first) |

## Deployment

### Recommended: frontend on Vercel, API on Render (both free tiers)

**API on Render**

1. Push the repo to GitHub. In Render choose *New → Blueprint* and select the repo; `backend/render.yaml` is picked up.
2. In the service's environment set `CORS_ALLOWED_ORIGINS` to your Vercel URL and `GEOCODER_USER_AGENT` to
   `eld-trip-planner/1.0 (your@email)`.
3. (Optional) attach a free Render Postgres and set `DATABASE_URL`; otherwise SQLite lives on the instance disk.
   Note that free instances sleep after inactivity – the first request can take ~30 s.

**Frontend on Vercel**

1. *Add New → Project*, import the repo, set **Root Directory** to `frontend` (Vite preset is auto-detected).
2. Add the environment variable `VITE_API_URL=https://<your-service>.onrender.com`.
3. Deploy. `frontend/vercel.json` rewrites all routes to `index.html` so `?trip=` links work.

### Alternative: everything on Vercel

`backend/vercel.json` deploys Django as a Python serverless function (`config/wsgi.py`). Create a second Vercel project
with **Root Directory** `backend`, set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS=.vercel.app` and
`CORS_ALLOWED_ORIGINS`. Caveat: the serverless file system is ephemeral, so without a `DATABASE_URL` (e.g. Neon/Supabase
Postgres) stored trips and share links reset between cold starts. Migrations run automatically on start-up when
`VERCEL` is set.

### Docker anywhere

`backend/Dockerfile` runs migrations and serves with gunicorn on `$PORT`; build the frontend with `npm run build` and
host `frontend/dist` on any static host with `VITE_API_URL` set at build time.

## Loom walkthrough (3–5 minutes)

1. **The app (90 s):** load an example, submit; walk through the summary cards, the map (leg colours, numbered stops,
   popups), the itinerary, then the daily logs – flip through the days, point out the duty line, remarks and the recap
   boxes; download a PNG; copy the share link and open it in a new tab.
2. **The engine (90 s):** `hos_planner.py` – the state variables and the check order in `plan()`; `logbook.py` – the
   midnight split and recap; `routing.py` – OSRM and the speed cap; `views.py` – geocode → route → simulate → logs.
3. **The frontend (60 s):** `LogSheet.jsx` – how the segments become the SVG path; `RouteMap.jsx`; the MUI theme.
4. **Quality & deployment (30 s):** `python manage.py test`, `render.yaml`, Vercel settings, and the caching layer.

## License

MIT
