import type { BBox } from './nominatim';

export type EstablishmentType = 'bar' | 'cafe' | 'restaurant';

export interface Establishment {
  osmId: string;
  name: string;
  type: EstablishmentType;
  lat: number;
  lng: number;
  address: string | null;
  website: string | null;
  outdoorSeating: boolean;
  /** Image URL (direct image link or derived from wikimedia_commons tag). null if unknown. */
  imageUrl: string | null;
}

function imageUrlFromTags(tags: Record<string, string>): string | null {
  const direct = tags.image;
  if (direct && /^https?:\/\//.test(direct)) return direct;

  const commons = tags.wikimedia_commons ?? tags['wikimedia_commons:name'];
  if (commons) {
    const match = commons.match(/^File:(.+)$/i);
    if (match) {
      const filename = match[1].trim().replace(/ /g, '_');
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=480`;
    }
  }
  return null;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];
const MAX_ATTEMPTS = 4;

function buildQuery(bbox: BBox): string {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:25];
(
  node["amenity"~"^(cafe|bar|restaurant)$"](${south},${west},${north},${east});
  way["amenity"~"^(cafe|bar|restaurant)$"](${south},${west},${north},${east});
);
out center tags;
`;
}

interface RawElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function coordsOf(el: RawElement): { lat: number; lng: number } | null {
  if (el.type === 'node' && el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.type === 'way' && el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function addressOf(tags: Record<string, string>): string | null {
  const street = tags['addr:street'];
  const housenumber = tags['addr:housenumber'];
  const city = tags['addr:city'];
  if (!street) return null;
  return [housenumber, street, city].filter(Boolean).join(' ');
}

async function fetchWithRetry(query: string): Promise<{ elements: RawElement[] }> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const endpoint = ENDPOINTS[attempt % ENDPOINTS.length];
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'terrasse-au-soleil.fr/1.0 (contact: sflandrin@outlook.com)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) return (await res.json()) as { elements: RawElement[] };
      const bodyText = await res.text().catch(() => '');
      const isRetryable = res.status >= 500 || res.status === 429 || res.status === 408;
      lastError = new Error(`Overpass HTTP ${res.status} at ${endpoint}: ${bodyText.slice(0, 200)}`);
      if (!isRetryable) throw lastError;
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      const delayMs = 2000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError ?? new Error('Overpass: all attempts failed');
}

export async function fetchEstablishments(bbox: BBox): Promise<Establishment[]> {
  const query = buildQuery(bbox);
  const json = await fetchWithRetry(query);
  const list: Establishment[] = [];
  for (const el of json.elements) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    const coords = coordsOf(el);
    if (!coords) continue;
    const amenity = tags.amenity;
    if (amenity !== 'cafe' && amenity !== 'bar' && amenity !== 'restaurant') continue;
    list.push({
      osmId: `${el.type}/${el.id}`,
      name,
      type: amenity,
      lat: coords.lat,
      lng: coords.lng,
      address: addressOf(tags),
      website: tags.website ?? tags['contact:website'] ?? null,
      outdoorSeating: tags.outdoor_seating === 'yes',
      imageUrl: imageUrlFromTags(tags),
    });
  }
  return list;
}
