export const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function fmtMinutes(min) {
  const total = Math.round(min || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function fmtClock(minuteOfDay) {
  const t = Math.round(minuteOfDay);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function fmtHM(min) {
  const t = Math.round(min || 0);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// ISO strings from the API carry no timezone: they are home-terminal local time.
export function parseLocal(iso) {
  return new Date(iso);
}

export function fmtTime(iso) {
  return parseLocal(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function fmtDate(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtDateTime(iso) {
  const d = parseLocal(iso);
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${fmtTime(iso)}`;
}

export function fmtMiles(mi) {
  return `${Math.round(mi || 0).toLocaleString()} mi`;
}

function utcDay(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function dayNumber(isoDate, firstIsoDate) {
  return Math.round((utcDay(isoDate) - utcDay(firstIsoDate)) / 86400000) + 1;
}

export const KIND_META = {
  start: { label: 'Start', color: '#0B1F44' },
  drive: { label: 'Driving', color: '#0B1F44' },
  pickup: { label: 'Pickup', color: '#7C3AED' },
  dropoff: { label: 'Drop-off', color: '#1B8A5A' },
  fuel: { label: 'Fuel stop', color: '#D97706' },
  break: { label: '30-min break', color: '#2563EB' },
  rest: { label: '10-hour rest', color: '#0E7490' },
  restart: { label: '34-hour restart', color: '#C62828' },
  off_duty: { label: 'Off duty', color: '#9AA3B2' },
};

export const STATUS_META = {
  off_duty: { label: 'Off duty', bg: '#EEF0F4', fg: '#3E4756' },
  sleeper_berth: { label: 'Sleeper berth', bg: '#E5E9FB', fg: '#3730A3' },
  driving: { label: 'Driving', bg: '#DCE4F7', fg: '#0B1F44' },
  on_duty: { label: 'On duty', bg: '#FDECC8', fg: '#8A4B00' },
};

export const US_STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO',
  Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
  Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
  Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA',
  Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};
