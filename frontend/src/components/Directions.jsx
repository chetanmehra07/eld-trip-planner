import { Accordion, AccordionDetails, AccordionSummary, Chip, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { fmtMiles, fmtMinutes } from '../utils/format';

export default function Directions({ plan }) {
  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {plan.route.legs.map((leg, i) => (
        <Accordion key={leg.index} disableGutters elevation={0} sx={{ borderTop: i ? 1 : 0, borderColor: 'divider', '&.Mui-expanded': { m: 0 } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
              <Chip size="small" label={`Leg ${leg.index + 1}`} color={leg.index === 0 ? 'info' : 'primary'} />
              <Typography fontWeight={600}>
                {leg.from.name} → {leg.to.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {fmtMiles(leg.distance_miles)} · {fmtMinutes(leg.duration_minutes)} · {leg.steps.length} steps
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, maxHeight: 420, overflowY: 'auto' }}>
            {leg.steps.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
                Turn-by-turn instructions are not available from the routing provider.
              </Typography>
            ) : (
              <List dense disablePadding>
                {leg.steps.map((step, index) => (
                  <ListItem key={index} divider sx={{ px: 2 }}>
                    <ListItemText
                      primary={step.instruction}
                      secondary={step.distance_miles >= 0.1 ? `${fmtMiles(step.distance_miles)} · ${fmtMinutes(step.duration_minutes)}` : null}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );
}
