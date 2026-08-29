import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Container,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import TimelineIcon from "@mui/icons-material/Timeline";
import ListAltIcon from "@mui/icons-material/ListAlt";
import TurnRightIcon from "@mui/icons-material/TurnRight";
import Header from "./components/Header";
import TripForm, { defaultForm, formFromPlan } from "./components/TripForm";
import SummaryCards from "./components/SummaryCards";
import RouteMap from "./components/RouteMap";
import Itinerary from "./components/Itinerary";
import DailyLogs from "./components/DailyLogs";
import Directions from "./components/Directions";
import EmptyState from "./components/EmptyState";
import RecentTrips from "./components/RecentTrips";
import SectionTitle from "./components/SectionTitle";
import { extractError, getTrip, listTrips, planTrip } from "./api/client";

const LOADING_STEPS = [
  "Geocoding locations…",
  "Fetching the route from OpenStreetMap…",
  "Simulating hours of service…",
  "Naming stops and drawing log sheets…",
];

function LoadingCard({ step }) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        {LOADING_STEPS[step]}
      </Typography>
      <LinearProgress color="secondary" sx={{ mb: 3, borderRadius: 2 }} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={84} />
        ))}
      </Box>
      <Skeleton variant="rounded" height={360} />
    </Paper>
  );
}

export default function App() {
  const [form, setForm] = useState(defaultForm);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const resultsRef = useRef(null);

  const refreshRecent = useCallback(async () => {
    try {
      setRecent(await listTrips());
    } catch {
      /* the list is a convenience; ignore failures */
    }
  }, []);

  const applyPlan = useCallback((data) => {
    setPlan(data);
    setForm(formFromPlan(data));
    const url = new URL(window.location.href);
    url.searchParams.set("trip", data.id);
    window.history.replaceState({}, "", url);
    window.setTimeout(
      () =>
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      60,
    );
  }, []);

  const loadTrip = useCallback(
    async (id) => {
      setLoading(true);
      setError(null);
      try {
        applyPlan(await getTrip(id));
      } catch (err) {
        setError(
          err?.response?.status === 404
            ? "That trip link no longer exists. Plan a new trip below."
            : extractError(err),
        );
      } finally {
        setLoading(false);
      }
    },
    [applyPlan],
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("trip");
    if (id) loadTrip(id);
    refreshRecent();
  }, [loadTrip, refreshRecent]);

  useEffect(() => {
    if (!loading) return undefined;
    setLoadingStep(0);
    const timer = window.setInterval(
      () =>
        setLoadingStep((step) => Math.min(step + 1, LOADING_STEPS.length - 1)),
      1800,
    );
    return () => window.clearInterval(timer);
  }, [loading]);

  const handleSubmit = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      applyPlan(await planTrip(payload));
      refreshRecent();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header />
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "380px minmax(0, 1fr)" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Box
            sx={{
              position: { lg: "sticky" },
              top: { lg: 84 },
              // cap the sidebar at the viewport (84px header offset + 24px bottom padding)
              maxHeight: { lg: "calc(100vh - 108px)" },
              overflowY: { lg: "auto" },
              // keep the scrollbar in the gutter so it doesn't overlap the card border
              pr: { lg: 1 },
              mr: { lg: -1 },
              scrollbarGutter: "stable",
              // thin, unobtrusive scrollbar
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": { width: 6 },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: "#C5CBD8",
                borderRadius: 3,
              },
              "&::-webkit-scrollbar-thumb:hover": { bgcolor: "#9AA3B2" },
            }}
          >
            <TripForm
              form={form}
              setForm={setForm}
              loading={loading}
              onSubmit={handleSubmit}
            />
            <RecentTrips
              trips={recent}
              activeId={plan?.id}
              onSelect={loadTrip}
            />
          </Box>

          <Box ref={resultsRef} sx={{ scrollMarginTop: 84, minWidth: 0 }}>
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}
            {loading ? (
              <LoadingCard step={loadingStep} />
            ) : plan ? (
              <Stack spacing={4}>
                <SummaryCards plan={plan} />
                <Box>
                  <SectionTitle
                    icon={<MapIcon />}
                    title="Route & stops"
                    subtitle="Numbered markers match the itinerary. Leg 1 runs to the pickup, leg 2 to the drop-off."
                  />
                  <RouteMap plan={plan} />
                </Box>
                <Box>
                  <SectionTitle
                    icon={<TimelineIcon />}
                    title="Itinerary"
                    subtitle="Every drive, stop and rest in home-terminal time, with the duty status recorded on the log."
                  />
                  <Itinerary plan={plan} />
                </Box>
                <Box>
                  <SectionTitle
                    icon={<ListAltIcon />}
                    title="Daily log sheets"
                    subtitle={`${plan.summary.days} sheet${plan.summary.days === 1 ? "" : "s"} — the duty-status line, remarks and 70 hr / 8 day recap are filled in for each day.`}
                  />
                  <DailyLogs plan={plan} />
                </Box>
                <Box>
                  <SectionTitle
                    icon={<TurnRightIcon />}
                    title="Turn-by-turn directions"
                    subtitle="Road-by-road instructions for each leg."
                  />
                  <Directions plan={plan} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Assumptions: {plan.assumptions.join(" ")}
                </Typography>
              </Stack>
            ) : (
              <EmptyState />
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
