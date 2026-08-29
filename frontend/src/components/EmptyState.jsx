import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { MONO } from '../utils/format';

const RULES = [
  { value: '11 h', label: 'Driving limit', text: 'Maximum driving after 10 consecutive hours off duty.' },
  { value: '14 h', label: 'Driving window', text: 'No driving beyond the 14th hour after coming on duty. Breaks do not extend it.' },
  { value: '30 min', label: 'Rest break', text: 'Required after 8 cumulative hours of driving.' },
  { value: '70 h / 8 d', label: 'Cycle limit', text: 'No driving past 70 on-duty hours in 8 days; a 34-hour restart resets the cycle.' },
];

const ASSUMPTIONS = ['Property-carrying driver', 'No adverse conditions', 'Fuel every 1,000 mi', '1 hr pickup · 1 hr drop-off'];

export default function EmptyState() {
  return (
    <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
      <Typography variant="overline" color="secondary.dark">
        How it works
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.5, maxWidth: 560 }}>
        Enter a trip and get the route, every required stop, and a filled-in log sheet for each day.
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, maxWidth: 620 }}>
        The planner routes the trip over OpenStreetMap, then simulates the drive minute by minute under the FMCSA
        hours-of-service rules for property-carrying drivers. Fuel stops, 30-minute breaks, 10-hour rests and
        34-hour restarts are scheduled automatically and drawn onto the daily log grid.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 3 }}>
        {RULES.map((rule) => (
          <Box key={rule.label} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', borderLeft: 4, borderColor: 'secondary.main' }}>
            <Typography sx={{ fontFamily: MONO, fontWeight: 600, fontSize: 22, lineHeight: 1.1 }}>{rule.value}</Typography>
            <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
              {rule.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {rule.text}
            </Typography>
          </Box>
        ))}
      </Box>

      <Stack direction="row" flexWrap="wrap" gap={1} mt={3} alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Assumptions
        </Typography>
        {ASSUMPTIONS.map((item) => (
          <Chip key={item} size="small" label={item} variant="outlined" />
        ))}
      </Stack>
    </Paper>
  );
}
