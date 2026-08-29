import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import RouteIcon from '@mui/icons-material/Route';
import LocationAutocomplete from './LocationAutocomplete';
import { MONO } from '../utils/format';

export function toLocalInput(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

function nextQuarterHour() {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return toLocalInput(d);
}

export function defaultForm() {
  return {
    current: null,
    pickup: null,
    dropoff: null,
    cycle: 0,
    start_time: nextQuarterHour(),
    driver_name: '',
    carrier_name: '',
    truck_number: '',
    home_terminal: '',
  };
}

export function formFromPlan(plan) {
  const { inputs } = plan;
  return {
    current: inputs.current_location,
    pickup: inputs.pickup_location,
    dropoff: inputs.dropoff_location,
    cycle: inputs.current_cycle_used,
    start_time: inputs.start_time.slice(0, 16),
    driver_name: inputs.driver_name || '',
    carrier_name: inputs.carrier_name || '',
    truck_number: inputs.truck_number || '',
    home_terminal: inputs.home_terminal || '',
  };
}

const PRESETS = [
  {
    label: 'Chicago → Indianapolis → Nashville',
    current: { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
    pickup: { name: 'Indianapolis, IN', lat: 39.7684, lng: -86.1581 },
    dropoff: { name: 'Nashville, TN', lat: 36.1627, lng: -86.7816 },
    cycle: 12,
  },
  {
    label: 'Dallas → Denver → Seattle',
    current: { name: 'Dallas, TX', lat: 32.7767, lng: -96.797 },
    pickup: { name: 'Denver, CO', lat: 39.7392, lng: -104.9903 },
    dropoff: { name: 'Seattle, WA', lat: 47.6062, lng: -122.3321 },
    cycle: 20,
  },
  {
    label: 'New York → Chicago → Los Angeles',
    current: { name: 'New York, NY', lat: 40.7128, lng: -74.006 },
    pickup: { name: 'Chicago, IL', lat: 41.8781, lng: -87.6298 },
    dropoff: { name: 'Los Angeles, CA', lat: 34.0522, lng: -118.2437 },
    cycle: 48,
  },
];

const clampCycle = (value) => Math.min(70, Math.max(0, Number(value) || 0));

export default function TripForm({ form, setForm, loading, onSubmit }) {
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const ready = Boolean(form.current && form.pickup && form.dropoff) && !loading;
  const cycle = clampCycle(form.cycle);

  const submit = (event) => {
    event.preventDefault();
    if (!ready) return;
    onSubmit({
      current_location: form.current,
      pickup_location: form.pickup,
      dropoff_location: form.dropoff,
      current_cycle_used: cycle,
      start_time: form.start_time ? `${form.start_time}:00` : undefined,
      driver_name: form.driver_name,
      carrier_name: form.carrier_name,
      truck_number: form.truck_number,
      home_terminal: form.home_terminal,
    });
  };

  return (
    <Paper component="form" onSubmit={submit} sx={{ p: 2.5 }}>
      <Stack spacing={2.25}>
        <Box>
          <Typography variant="h6">Plan a trip</Typography>
          <Typography variant="body2" color="text.secondary">
            Enter the trip, and the planner routes it, schedules fuel and rest stops, and fills out a daily log for
            every day on the road.
          </Typography>
        </Box>

        <LocationAutocomplete
          label="Current location"
          placeholder="City, state or street address"
          value={form.current}
          onChange={set('current')}
          icon={<MyLocationIcon fontSize="small" />}
        />
        <LocationAutocomplete
          label="Pickup location"
          placeholder="Where the load is picked up"
          value={form.pickup}
          onChange={set('pickup')}
          icon={<Inventory2OutlinedIcon fontSize="small" />}
        />
        <LocationAutocomplete
          label="Drop-off location"
          placeholder="Where the load is delivered"
          value={form.dropoff}
          onChange={set('dropoff')}
          icon={<FlagOutlinedIcon fontSize="small" />}
        />

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2">Current cycle used</Typography>
            <TextField
              type="number"
              value={form.cycle}
              onChange={(e) => set('cycle')(e.target.value)}
              onBlur={() => set('cycle')(cycle)}
              inputProps={{ min: 0, max: 70, step: 0.5, style: { width: 56, textAlign: 'right', fontFamily: MONO } }}
              InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary">hrs</Typography> }}
              size="small"
            />
          </Stack>
          <Slider
            value={cycle}
            min={0}
            max={70}
            step={0.5}
            onChange={(_, value) => set('cycle')(value)}
            marks={[
              { value: 0, label: '0' },
              { value: 35, label: '35' },
              { value: 70, label: '70' },
            ]}
            valueLabelDisplay="auto"
            sx={{ mx: 0.5, width: 'calc(100% - 8px)' }}
          />
          <Typography variant="caption" color="text.secondary">
            On-duty hours already used in the current 8-day period.{' '}
            <Box component="span" sx={{ fontFamily: MONO, fontWeight: 600, color: 'text.primary' }}>
              {70 - cycle} hrs
            </Box>{' '}
            remain before a 34-hour restart is required.
          </Typography>
        </Box>

        <TextField
          label="Trip start (home terminal time)"
          type="datetime-local"
          value={form.start_time}
          onChange={(e) => set('start_time')(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />

        <Accordion disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Driver & carrier details (optional)</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Stack spacing={1.5}>
              <TextField label="Driver name" value={form.driver_name} onChange={(e) => set('driver_name')(e.target.value)} />
              <TextField label="Carrier name" value={form.carrier_name} onChange={(e) => set('carrier_name')(e.target.value)} />
              <TextField label="Truck / trailer numbers" value={form.truck_number} onChange={(e) => set('truck_number')(e.target.value)} />
              <TextField label="Home terminal address" value={form.home_terminal} onChange={(e) => set('home_terminal')(e.target.value)} />
            </Stack>
          </AccordionDetails>
        </Accordion>

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={!ready}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RouteIcon />}
        >
          {loading ? 'Planning trip…' : 'Plan trip & generate logs'}
        </Button>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Try an example
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75} mt={0.5}>
            {PRESETS.map((preset) => (
              <Chip
                key={preset.label}
                label={preset.label}
                size="small"
                variant="outlined"
                disabled={loading}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    current: preset.current,
                    pickup: preset.pickup,
                    dropoff: preset.dropoff,
                    cycle: preset.cycle,
                  }))
                }
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
