import SunCalc from 'suncalc';

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function computeSunPercent(
  lat: number,
  lng: number,
  date: Date,
  facing = 180,
  cloudCover = 0,
): { sunPercent: number; altitudeDeg: number } {
  const pos = SunCalc.getPosition(date, lat, lng);
  const altitudeDeg = (pos.altitude * 180) / Math.PI;
  const azimuthDeg = normalizeAngle((pos.azimuth * 180) / Math.PI + 180);

  if (altitudeDeg <= 0) {
    return { sunPercent: 0, altitudeDeg };
  }

  const normalized = normalizeAngle(facing);
  let angleDiff = Math.abs(azimuthDeg - normalized);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;
  const facingFactor = Math.max(0, Math.cos((angleDiff * Math.PI) / 180));
  const altitudeFactor = Math.sin((altitudeDeg * Math.PI) / 180);
  const clearSky = 1 - Math.max(0, Math.min(1, cloudCover));

  return {
    sunPercent: Math.round(facingFactor * altitudeFactor * clearSky * 100),
    altitudeDeg,
  };
}

// Module-level cache of in-flight / completed weather fetches.
// Key: rounded lat/lng (~10 km) + date → multiple terraces in the same
// neighborhood share a single Open-Meteo call, killing the 429 storm.
const weatherCache = new Map<string, Promise<number[] | null>>();

export function fetchHourlyCloudCover(lat: number, lng: number, date: Date): Promise<number[] | null> {
  const isoDate = date.toISOString().split('T')[0];
  const key = `${lat.toFixed(1)},${lng.toFixed(1)},${isoDate}`;
  const existing = weatherCache.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<number[] | null> => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
      `&hourly=cloudcover&start_date=${isoDate}&end_date=${isoDate}&timezone=UTC`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // On rate-limit / failure, evict so a later mount can retry.
        weatherCache.delete(key);
        return null;
      }
      const data = (await res.json()) as { hourly?: { cloudcover: number[] } };
      const covers = data.hourly?.cloudcover;
      return covers && covers.length === 24 ? covers : null;
    } catch {
      weatherCache.delete(key);
      return null;
    }
  })();

  weatherCache.set(key, promise);
  return promise;
}
