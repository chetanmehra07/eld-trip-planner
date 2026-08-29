import { Box, Button, Chip, Container, Stack, Typography } from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export default function Header() {
  return (
    <Box component="header" sx={{ bgcolor: 'primary.main', color: '#fff', position: 'sticky', top: 0, zIndex: 1100 }}>
      <Container maxWidth="xl">
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ py: 1.25 }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: 'secondary.main', display: 'grid', placeItems: 'center', color: '#1A1A1A' }}>
            <LocalShippingIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.15}>
              ELD Trip Planner
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', lineHeight: 1.2 }}>
              FMCSA Hours of Service · property-carrying · 70 hr / 8 day
            </Typography>
          </Box>
          <Box flex={1} />
          <Chip
            size="small"
            variant="outlined"
            label="Django REST · React · MUI · Leaflet"
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.35)', display: { xs: 'none', md: 'inline-flex' } }}
          />
          <Button
            size="small"
            color="inherit"
            endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
            href="https://www.fmcsa.dot.gov/regulations/hours-service/summary-hours-service-regulations"
            target="_blank"
            rel="noreferrer"
            sx={{ opacity: 0.9 }}
          >
            HOS rules
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}
