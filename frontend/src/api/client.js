import axios from 'axios';
import { US_STATE_ABBR } from '../utils/format';

const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL, timeout: 90000 });

export async function planTrip(payload) {
  const { data } = await api.post('/api/trips/plan/', payload);
  return data;
}

export async function getTrip(id) {
  const { data } = await api.get(`/api/trips/${id}/`);
  return data;
}

export async function listTrips() {
  const { data } = await api.get('/api/trips/');
  return data;
}

/** Address autocomplete via Photon (OpenStreetMap) – free, CORS-enabled, no key. */
export async function searchPlaces(query, signal) {
  const { data } = await axios.get('https://photon.komoot.io/api/', {
    params: { q: query, limit: 7, lang: 'en' },
    signal,
  });
  const seen = new Set();
  const results = [];
  for (const feature of data.features || []) {
    const p = feature.properties || {};
    const [lng, lat] = feature.geometry.coordinates;
    const region = p.state ? (p.countrycode === 'US' ? US_STATE_ABBR[p.state] || p.state : p.state) : null;
    const primary = [p.name, p.city && p.city !== p.name ? p.city : null, region].filter(Boolean).join(', ');
    const secondary = [
      p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : null,
      p.postcode,
      p.country,
    ]
      .filter(Boolean)
      .join(' · ');
    const key = `${primary}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
    if (!primary || seen.has(key)) continue;
    seen.add(key);
    results.push({ name: primary, secondary, lat, lng });
  }
  return results;
}

export function extractError(error) {
  const data = error?.response?.data;
  if (!data) return error?.message || 'Something went wrong. Please try again.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  return Object.entries(data)
    .map(([field, messages]) => `${field.replace(/_/g, ' ')}: ${[].concat(messages).join(' ')}`)
    .join(' ');
}
