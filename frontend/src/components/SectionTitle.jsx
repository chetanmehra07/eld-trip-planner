import { Box, Stack, Typography } from '@mui/material';

export default function SectionTitle({ icon, title, subtitle, action }) {
  return (
    <Stack direction="row" alignItems="flex-end" gap={1.5} sx={{ mb: 1.5 }}>
      <Box sx={{ color: 'primary.main', display: 'flex', pb: 0.25 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" lineHeight={1.2}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}
