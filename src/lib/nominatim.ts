export interface BBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

const USER_AGENT = 'terrasse-au-soleil.fr/1.0 (contact: sflandrin@outlook.com)';

export async function geocode(query: string): Promise<BBox> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ boundingbox: [string, string, string, string] }>;
  if (!data.length) throw new Error(`No Nominatim result for "${query}"`);
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  return { south, north, west, east };
}

export async function geocodeThrottled(query: string): Promise<BBox> {
  const res = await geocode(query);
  await new Promise((r) => setTimeout(r, 1100));
  return res;
}
