export interface CloudCoverInput {
  lat: number;
  lng: number;
  date: Date;
}

/**
 * Fetch cloud cover percentage (0-100) at a given lat/lng/time via Open-Meteo.
 * Returns null if API fails or the requested time is outside available forecast (~16 days).
 */
export async function fetchCloudCover(input: CloudCoverInput): Promise<number | null> {
  const isoDate = input.date.toISOString().split('T')[0];
  const targetHourUtc = input.date.getUTCHours();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.lng}` +
    `&hourly=cloudcover&start_date=${isoDate}&end_date=${isoDate}&timezone=UTC`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      hourly?: { time: string[]; cloudcover: number[] };
    };
    const times = data.hourly?.time;
    const covers = data.hourly?.cloudcover;
    if (!times || !covers) return null;
    const idx = targetHourUtc;
    const pct = covers[idx];
    if (typeof pct !== 'number') return null;
    return Math.max(0, Math.min(100, pct));
  } catch {
    return null;
  }
}

/** Convenience: returns 0-1 factor (1 = fully overcast). Null on error. */
export async function fetchCloudCoverFactor(input: CloudCoverInput): Promise<number | null> {
  const pct = await fetchCloudCover(input);
  return pct == null ? null : pct / 100;
}

/**
 * Fetch the full 24-hour cloud-cover series (percentages 0-100, UTC-indexed)
 * for the given date. Returns null on error or if the series isn't exactly
 * 24 entries. Used by the live client to render the hourly sun chart.
 */
export async function fetchHourlyCloudCover(
  input: Pick<CloudCoverInput, 'lat' | 'lng' | 'date'>,
): Promise<number[] | null> {
  const isoDate = input.date.toISOString().split('T')[0];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.lng}` +
    `&hourly=cloudcover&start_date=${isoDate}&end_date=${isoDate}&timezone=UTC`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: { cloudcover: number[] } };
    const covers = data.hourly?.cloudcover;
    if (!covers || covers.length !== 24) return null;
    return covers;
  } catch {
    return null;
  }
}
