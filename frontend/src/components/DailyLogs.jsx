import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import LogSheet, { downloadSvgAsPng } from './LogSheet';
import { MONO, STATUS_META, fmtDate, fmtHM, fmtMiles } from '../utils/format';

export default function DailyLogs({ plan }) {
  const logs = plan.daily_logs;
  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    setTab(0);
  }, [plan.id]);

  const log = logs[Math.min(tab, logs.length - 1)];

  const download = async () => {
    if (!svgRef.current) return;
    setSaving(true);
    try {
      await downloadSvgAsPng(svgRef.current, `eld-log-day-${log.day_index}-${log.date}.png`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        gap={1}
        sx={{ px: { xs: 1, sm: 2 }, pt: 0.5, pb: { xs: 1, sm: 0 }, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tabs value={Math.min(tab, logs.length - 1)} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ flex: 1, minWidth: 0 }}>
          {logs.map((item) => (
            <Tab
              key={item.date}
              label={
                <Box textAlign="left">
                  <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
                    Day {item.day_index}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: MONO }}>
                    {fmtDate(item.date)}
                  </Typography>
                </Box>
              }
            />
          ))}
        </Tabs>
        <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={download} disabled={saving} sx={{ flexShrink: 0 }}>
          {saving ? 'Saving…' : 'Download PNG'}
        </Button>
      </Stack>

      {/* graph-paper backdrop to set the sheet apart */}
      <Box
        sx={{
          p: { xs: 1, md: 2.5 },
          backgroundColor: '#E9EDF5',
          backgroundImage:
            'linear-gradient(rgba(11,31,68,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(11,31,68,.06) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        <Box sx={{ maxWidth: 1000, mx: 'auto', boxShadow: '0 2px 8px rgba(11,31,68,.18)', bgcolor: '#fff' }}>
          <LogSheet ref={svgRef} log={log} inputs={plan.inputs} />
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, md: 2.5 }, py: 2 }}>
        <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" mb={2}>
          {Object.entries(STATUS_META).map(([status, meta]) => (
            <Chip
              key={status}
              size="small"
              label={`${meta.label} ${fmtHM(log.totals[status])}`}
              sx={{ bgcolor: meta.bg, color: meta.fg, fontFamily: MONO, fontWeight: 600 }}
            />
          ))}
          <Chip size="small" variant="outlined" label={fmtMiles(log.total_miles)} sx={{ fontFamily: MONO }} />
          <Box flex={1} />
          <Typography variant="caption" color="text.secondary">
            Recap: {fmtHM(log.recap.last_8_days)} used in the last 8 days · {fmtHM(log.recap.available_tomorrow)} available tomorrow
          </Typography>
        </Stack>

        <Typography variant="subtitle2" gutterBottom>
          Remarks — duty status changes
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 80 }}>Time</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Activity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {log.remarks.map((remark, i) => (
              <TableRow key={`${remark.minute}-${i}`}>
                <TableCell sx={{ fontFamily: MONO, fontWeight: 600 }}>{remark.time}</TableCell>
                <TableCell>{remark.location}</TableCell>
                <TableCell>{remark.label}</TableCell>
              </TableRow>
            ))}
            {log.remarks.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} sx={{ color: 'text.secondary' }}>
                  No change of duty status on this day (continuing {log.segments[0]?.status_label.toLowerCase()}).
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
