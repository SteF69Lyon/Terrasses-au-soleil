export interface CloudCoverInput {
  lat: number;
  lng: number;
  date: Date;
}

/** Returns cloud cover % (0-100) or null on error / out-of-range. */
export async function fetchCloudCover(input: CloudCoverInput): Promise<number | null> {
  const isoDate = input.date.toISOString().split('T')[0];
  const targetHourUtc = input.date.getUTCHours();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${input.lat}&longitude=${input.lng}` +
    `&hourly=cloudcover&start_date=${isoDate}&end_date=${isoDate}&timezone=UTC`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: { time: string[]; cloudcover: number[] } };
    const covers = data.hourly?.cloudcover;
    if (!covers) return null;
    const pct = covers[targetHourUtc];
    if (typeof pct !== 'number') return null;
    return Math.max(0, Math.min(100, pct));
  } catch {
    return null;
  }
}

/** Convenience: returns 0-1 factor (1 = overcast). Null on error. */
export async function fetchCloudCoverFactor(input: CloudCoverInput): Promise<number | null> {
  const pct = await fetchCloudCover(input);
  return pct == null ? null : pct / 100;
}
