import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { KIND_META, fmtDateTime, fmtMiles, fmtMinutes } from '../utils/format';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> · Routing &copy; <a href="https://project-osrm.org/">OSRM</a>';
const LEG_COLORS = ['#2563EB', '#0B1F44'];

function makeIcon({ color, text, size = 26, square = false }) {
  return L.divIcon({
    className: 'eld-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:${square ? '7px' : '50%'};background:${color};color:#fff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font:600 ${size > 26 ? 12 : 11}px 'IBM Plex Sans',sans-serif;">${text}</div>`,
  });
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  }, [bounds, map]);
  return null;
}

function LegendDot({ color, text, square }) {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: square ? '5px' : '50%',
        bgcolor: color,
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {text}
    </Box>
  );
}

export default function RouteMap({ plan }) {
  const { inputs, route, stops } = plan;
  const waypoints = [
    { ...inputs.current_location, text: 'S', color: KIND_META.start.color, title: 'Start · current location' },
    { ...inputs.pickup_location, text: 'P', color: KIND_META.pickup.color, title: 'Pickup (1 hr on duty)' },
    { ...inputs.dropoff_location, text: 'D', color: KIND_META.dropoff.color, title: 'Drop-off (1 hr on duty)' },
  ];
  const intermediate = stops.filter((stop) => stop.kind !== 'pickup' && stop.kind !== 'dropoff');
  const legendKinds = ['fuel', 'break', 'rest', 'restart'].filter((kind) => intermediate.some((s) => s.kind === kind));

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Box sx={{ height: { xs: 360, md: 480 } }}>
        <MapContainer key={plan.id} bounds={route.bounds} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
          {route.legs.map((leg) => (
            <Polyline
              key={leg.index}
              positions={leg.geometry}
              pathOptions={{ color: LEG_COLORS[leg.index % LEG_COLORS.length], weight: 5, opacity: 0.85 }}
            />
          ))}
          {intermediate.map((stop, i) => (
            <Marker
              key={`stop-${i}`}
              position={[stop.location.lat, stop.location.lng]}
              icon={makeIcon({ color: KIND_META[stop.kind].color, text: i + 1 })}
            >
              <Popup>
                <strong>
                  {i + 1}. {stop.label}
                </strong>
                <br />
                {stop.location.name}
                <br />
                {fmtDateTime(stop.start)} → {fmtMinutes(stop.duration_minutes)} · {stop.status_label}
                <br />
                <span style={{ color: '#5B6475' }}>{fmtMiles(stop.odometer_start)} into the trip</span>
              </Popup>
            </Marker>
          ))}
          {waypoints.map((wp) => (
            <Marker key={wp.text} position={[wp.lat, wp.lng]} icon={makeIcon({ color: wp.color, text: wp.text, size: 30, square: true })} zIndexOffset={1000}>
              <Popup>
                <strong>{wp.title}</strong>
                <br />
                {wp.name}
              </Popup>
            </Marker>
          ))}
          <FitBounds bounds={route.bounds} />
        </MapContainer>
      </Box>
      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={2} sx={{ px: 2, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
        {waypoints.map((wp) => (
          <Stack key={wp.text} direction="row" alignItems="center" gap={0.75}>
            <LegendDot color={wp.color} text={wp.text} square />
            <Typography variant="caption">{wp.title.split(' ·')[0].split(' (')[0]}</Typography>
          </Stack>
        ))}
        {legendKinds.map((kind) => (
          <Stack key={kind} direction="row" alignItems="center" gap={0.75}>
            <LegendDot color={KIND_META[kind].color} text="#" />
            <Typography variant="caption">{KIND_META[kind].label}</Typography>
          </Stack>
        ))}
        <Box flex={1} />
        {route.legs.map((leg) => (
          <Stack key={leg.index} direction="row" alignItems="center" gap={0.75}>
            <Box sx={{ width: 22, height: 4, borderRadius: 2, bgcolor: LEG_COLORS[leg.index % LEG_COLORS.length] }} />
            <Typography variant="caption">
              Leg {leg.index + 1} · {leg.name} · {fmtMiles(leg.distance_miles)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
