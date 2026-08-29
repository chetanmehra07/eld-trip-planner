import { useState } from 'react';
import { Box, Button, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import StraightenIcon from '@mui/icons-material/Straighten';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EventIcon from '@mui/icons-material/Event';
import FlagIcon from '@mui/icons-material/Flag';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import CoffeeIcon from '@mui/icons-material/Coffee';
import HotelIcon from '@mui/icons-material/Hotel';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import { MONO, fmtDateTime, fmtMiles, fmtMinutes } from '../utils/format';

function Stat({ icon, label, value, sub, accent }) {
  return (
    <Paper sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          bgcolor: accent ? 'secondary.main' : 'primary.main',
          color: accent ? '#1A1A1A' : '#fff',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontFamily: MONO, lineHeight: 1.25, fontWeight: 600 }} noWrap>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" display="block">
            {sub}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default function SummaryCards({ plan }) {
  const s = plan.summary;
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Stat
          icon={<StraightenIcon />}
          label="Total distance"
          value={fmtMiles(s.total_miles)}
          sub={`${plan.route.legs.length} legs · avg ${s.average_speed_mph} mph`}
        />
        <Stat
          icon={<AccessTimeIcon />}
          label="Driving time"
          value={fmtMinutes(s.driving_minutes)}
          sub={`${fmtMinutes(s.on_duty_minutes)} on duty in total`}
        />
        <Stat
          icon={<EventIcon />}
          label="Trip duration"
          value={fmtMinutes(s.total_minutes)}
          sub={`${s.days} day${s.days === 1 ? '' : 's'} · ${s.days} log sheet${s.days === 1 ? '' : 's'}`}
        />
        <Stat icon={<FlagIcon />} label="Delivery" value={fmtDateTime(s.end_time)} sub={`Departs ${fmtDateTime(s.start_time)}`} accent />
      </Box>

      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} mt={2}>
        <Chip icon={<LocalGasStationIcon />} label={`${s.fuel_stops} fuel stop${s.fuel_stops === 1 ? '' : 's'}`} />
        <Chip icon={<CoffeeIcon />} label={`${s.rest_breaks} × 30-min break`} />
        <Chip icon={<HotelIcon />} label={`${s.ten_hour_rests} × 10-hr rest`} />
        {s.restarts > 0 && <Chip color="error" icon={<RestartAltIcon />} label={`${s.restarts} × 34-hr restart`} />}
        <Tooltip title="On-duty hours in the rolling 8-day window when the delivery is complete">
          <Chip variant="outlined" label={`Cycle at delivery: ${s.cycle_hours_used_at_end} / 70 hrs`} sx={{ fontFamily: MONO }} />
        </Tooltip>
        <Box flex={1} />
        <Button size="small" startIcon={copied ? <CheckIcon /> : <LinkIcon />} onClick={copyLink} color={copied ? 'success' : 'primary'}>
          {copied ? 'Link copied' : 'Copy share link'}
        </Button>
      </Stack>
    </Box>
  );
}
