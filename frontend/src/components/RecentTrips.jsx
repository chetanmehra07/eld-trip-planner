import { List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { MONO, fmtMiles, fmtMinutes } from '../utils/format';

export default function RecentTrips({ trips, activeId, onSelect }) {
  if (!trips?.length) return null;
  return (
    <Paper sx={{ mt: 2, overflow: 'hidden' }}>
      <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        Recent trips
      </Typography>
      <List dense disablePadding>
        {trips.map((trip) => (
          <ListItemButton key={trip.id} selected={trip.id === activeId} onClick={() => onSelect(trip.id)}>
            <ListItemText
              primary={`${trip.current_location.name} → ${trip.pickup_location.name} → ${trip.dropoff_location.name}`}
              secondary={`${fmtMiles(trip.total_miles)} · ${fmtMinutes(trip.total_duration_minutes)} · ${trip.days} day${trip.days === 1 ? '' : 's'}`}
              primaryTypographyProps={{ variant: 'body2', noWrap: true }}
              secondaryTypographyProps={{ sx: { fontFamily: MONO, fontSize: 11 } }}
            />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );
}
