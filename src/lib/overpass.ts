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
}

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

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

export async function fetchEstablishments(bbox: BBox): Promise<Establishment[]> {
  const query = buildQuery(bbox);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const json = (await res.json()) as { elements: RawElement[] };
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
    });
  }
  return list;
}
