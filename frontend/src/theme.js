import { createTheme } from '@mui/material/styles';

// "Dispatch console" palette: navy ink from the FMCSA guide, the highlighter
// amber from its table of contents, blue ink for hand-drawn log lines.
export const tokens = {
  navy: '#0B1F44',
  navyLight: '#24407A',
  amber: '#F5A524',
  ink: '#1D4ED8',
  slate: '#5B6475',
  surface: '#EEF1F6',
};

export const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
export const SANS = '"IBM Plex Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: tokens.navy, light: tokens.navyLight, dark: '#06122B', contrastText: '#FFFFFF' },
    secondary: { main: tokens.amber, dark: '#D68A0A', light: '#FFD37A', contrastText: '#1A1A1A' },
    background: { default: tokens.surface, paper: '#FFFFFF' },
    text: { primary: '#101828', secondary: tokens.slate },
    info: { main: '#2563EB' },
    success: { main: '#1B8A5A' },
    warning: { main: '#D97706' },
    error: { main: '#C62828' },
    divider: '#E1E5EE',
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: SANS,
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    overline: { letterSpacing: '0.12em', fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: '1px solid #E1E5EE', backgroundImage: 'none' } },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        sizeLarge: { paddingTop: 12, paddingBottom: 12 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiTooltip: { defaultProps: { arrow: true } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: 56 } } },
    MuiAccordion: { styleOverrides: { root: { '&:before': { display: 'none' } } } },
  },
});

export default theme;
