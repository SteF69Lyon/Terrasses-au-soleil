import type { BBox } from './nominatim';

export interface Building {
  osmId: string;
  /** Polygon vertices as [lng, lat] pairs (closed: first = last). */
  polygon: [number, number][];
  /** Height in meters. If unknown, defaults to 10 m (~3 étages) when levels absent. */
  height: number;
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

function buildBuildingsQuery(bbox: BBox): string {
  const { south, west, north, east } = bbox;
  return `
[out:json][timeout:30];
(
  way["building"](${south},${west},${north},${east});
);
out geom tags;
`;
}

interface RawWay {
  type: 'way';
  id: number;
  geometry?: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}

function parseHeight(tags: Record<string, string>): number {
  const hRaw = tags['height'] ?? tags['building:height'];
  if (hRaw) {
    const h = parseFloat(hRaw);
    if (!Number.isNaN(h) && h > 0) return h;
  }
  const levels = tags['building:levels'];
  if (levels) {
    const l = parseFloat(levels);
    if (!Number.isNaN(l) && l > 0) return l * 3;
  }
  return 10;
}

export async function fetchBuildings(bbox: BBox): Promise<Building[]> {
  const query = buildBuildingsQuery(bbox);
  for (let i = 0; i < ENDPOINTS.length; i++) {
    try {
      const res = await fetch(ENDPOINTS[i], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'terrasse-au-soleil.fr/1.0 (contact: sflandrin@outlook.com)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { elements: RawWay[] };
      const out: Building[] = [];
      for (const w of json.elements) {
        if (!w.geometry || w.geometry.length < 3) continue;
        const polygon: [number, number][] = w.geometry.map((p) => [p.lon, p.lat]);
        const first = polygon[0];
        const last = polygon[polygon.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) polygon.push(first);
        out.push({
          osmId: `way/${w.id}`,
          polygon,
          height: parseHeight(w.tags ?? {}),
        });
      }
      return out;
    } catch {
      // try next endpoint
    }
  }
  return [];
}

/* ---------- Geometric helpers (local equirectangular projection) ---------- */

const METERS_PER_DEG_LAT = 111_320;
function metersPerDegLng(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

/** Convert [lng, lat] to local meters around a reference point. */
function toLocal(ref: [number, number], point: [number, number]): [number, number] {
  const mLng = metersPerDegLng(ref[1]);
  return [(point[0] - ref[0]) * mLng, (point[1] - ref[1]) * METERS_PER_DEG_LAT];
}

/** Bearing in degrees (0=N, 90=E) from point a to point b. */
function bearingDeg(a: [number, number], b: [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const rad = Math.atan2(dx, dy);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/** Polygon centroid in [lng, lat]. */
function centroid(polygon: [number, number][]): [number, number] {
  let sx = 0;
  let sy = 0;
  const n = polygon.length - 1;
  for (let i = 0; i < n; i++) {
    sx += polygon[i][0];
    sy += polygon[i][1];
  }
  return [sx / n, sy / n];
}

/** Longest-edge bearing (degrees, 0-180 since edges have two directions). */
export function longestEdgeBearing(polygon: [number, number][]): number {
  let best = 0;
  let bestLen = 0;
  const ref = polygon[0];
  const localPts = polygon.map((p) => toLocal(ref, p));
  for (let i = 0; i < localPts.length - 1; i++) {
    const a = localPts[i];
    const b = localPts[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len > bestLen) {
      bestLen = len;
      best = bearingDeg(a, b);
    }
  }
  return best % 180;
}

/**
 * Infer a terrace's facing direction (0=N, 90=E) based on the nearest building's
 * orientation. Terrace is assumed to face outward, perpendicular to the building's
 * longest edge, on the side away from the building centroid.
 */
export function inferFacing(point: [number, number], buildings: Building[]): number | null {
  let nearest: Building | null = null;
  let nearestDist = Infinity;
  for (const b of buildings) {
    const c = centroid(b.polygon);
    const local = toLocal(point, c);
    const d = Math.hypot(local[0], local[1]);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = b;
    }
  }
  if (!nearest || nearestDist > 80) return null;

  const edgeBearing = longestEdgeBearing(nearest.polygon);
  const perp1 = (edgeBearing + 90) % 360;
  const perp2 = (edgeBearing + 270) % 360;

  const c = centroid(nearest.polygon);
  const centroidLocal = toLocal(point, c);
  const pointToCentroidBearing = bearingDeg([0, 0], centroidLocal);
  const d1 = angleDelta(perp1, pointToCentroidBearing);
  const d2 = angleDelta(perp2, pointToCentroidBearing);
  return d1 > d2 ? perp1 : perp2;
}

function angleDelta(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/* ---------- Shadow checks ---------- */

/**
 * True if the point is inside the shadow of any nearby building, cast by a sun
 * at (azimuth, altitude) in degrees. Uses a 2D projection of each building's
 * bounding-box polygon + projected shadow as a rough approximation.
 */
export function isShadowed(
  point: [number, number],
  buildings: Building[],
  sunAzimuthDeg: number,
  sunAltitudeDeg: number,
): boolean {
  if (sunAltitudeDeg <= 0) return false;
  const shadowAzimuth = (sunAzimuthDeg + 180) % 360;
  const shadowRad = (shadowAzimuth * Math.PI) / 180;
  const shadowDir: [number, number] = [Math.sin(shadowRad), Math.cos(shadowRad)];
  const tanAlt = Math.tan((sunAltitudeDeg * Math.PI) / 180);
  if (tanAlt <= 0) return false;

  const pLocal: [number, number] = [0, 0];
  for (const b of buildings) {
    const c = centroid(b.polygon);
    const centerLocal = toLocal(point, c);
    const centerDist = Math.hypot(centerLocal[0], centerLocal[1]);
    const maxShadow = b.height / tanAlt;
    if (centerDist > maxShadow + 60) continue;

    const shadowLen = b.height / tanAlt;
    const poly: [number, number][] = b.polygon.map((p) => toLocal(point, p));
    const shadowPoly: [number, number][] = poly.map((v) => [
      v[0] + shadowDir[0] * shadowLen,
      v[1] + shadowDir[1] * shadowLen,
    ]);
    const combined = convexHull([...poly, ...shadowPoly]);
    if (pointInPolygon(pLocal, combined)) return true;
  }
  return false;
}

function pointInPolygon(p: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}
