import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import FlagIcon from '@mui/icons-material/Flag';
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import CoffeeIcon from '@mui/icons-material/Coffee';
import HotelIcon from '@mui/icons-material/Hotel';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { KIND_META, MONO, STATUS_META, dayNumber, fmtDate, fmtMiles, fmtMinutes, fmtTime } from '../utils/format';

const ICONS = {
  drive: LocalShippingIcon,
  pickup: Inventory2Icon,
  dropoff: FlagIcon,
  fuel: LocalGasStationIcon,
  break: CoffeeIcon,
  rest: HotelIcon,
  restart: RestartAltIcon,
};

function details(event) {
  if (event.kind === 'drive') {
    return `${fmtMiles(event.miles)} · ${fmtMinutes(event.duration_minutes)} · ${event.location.name} → ${event.end_location?.name}`;
  }
  return `${fmtMinutes(event.duration_minutes)} · ${event.location.name}${event.note ? ` · ${event.note}` : ''}`;
}

function EventRow({ event, last }) {
  const meta = KIND_META[event.kind];
  const status = STATUS_META[event.status];
  const Icon = ICONS[event.kind] || LocalShippingIcon;
  const endsAnotherDay = event.end.slice(0, 10) !== event.start.slice(0, 10);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '58px 30px 1fr', sm: '104px 34px 1fr' }, columnGap: { xs: 1, sm: 1.5 } }}>
      <Box sx={{ pt: 0.6 }}>
        <Typography sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{fmtTime(event.start)}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO, display: 'block' }}>
          → {fmtTime(event.end)}
          {endsAnotherDay ? ' +1d' : ''}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            bgcolor: meta.color,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {event.badge ?? <Icon sx={{ fontSize: 16 }} />}
        </Box>
        {!last && <Box sx={{ width: 2, flex: 1, bgcolor: 'divider', my: 0.5, minHeight: 12 }} />}
      </Box>
      <Box sx={{ pb: last ? 0 : 2.25, pt: 0.4, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography fontWeight={600}>{event.label}</Typography>
          <Chip size="small" label={status.label} sx={{ bgcolor: status.bg, color: status.fg, fontWeight: 600, height: 22 }} />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {details(event)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function Itinerary({ plan }) {
  const firstDate = plan.daily_logs[0]?.date || plan.summary.start_time;
  const events = plan.timeline.filter((event) => event.kind !== 'off_duty');
  const groups = [];
  let stopNumber = 0;
  for (const event of events) {
    const day = event.start.slice(0, 10);
    let group = groups[groups.length - 1];
    if (!group || group.day !== day) {
      group = { day, items: [] };
      groups.push(group);
    }
    const isNumberedStop = !['drive', 'pickup', 'dropoff'].includes(event.kind);
    group.items.push({ ...event, badge: isNumberedStop ? (stopNumber += 1) : null });
  }

  return (
    <Paper sx={{ p: { xs: 1.5, md: 2.5 } }}>
      {groups.map((group, gi) => (
        <Box key={group.day} sx={{ mb: gi < groups.length - 1 ? 2.5 : 0 }}>
          <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1.5 }}>
            <Typography variant="overline" color="primary" sx={{ lineHeight: 1 }}>
              Day {dayNumber(group.day, firstDate)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
              {fmtDate(group.day)}
            </Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
          </Stack>
          {group.items.map((event, i) => (
            <EventRow key={`${event.start}-${i}`} event={event} last={i === group.items.length - 1} />
          ))}
        </Box>
      ))}
    </Paper>
  );
}
