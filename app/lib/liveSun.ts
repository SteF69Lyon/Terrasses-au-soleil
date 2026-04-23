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

export async function fetchHourlyCloudCover(lat: number, lng: number, date: Date): Promise<number[] | null> {
  const isoDate = date.toISOString().split('T')[0];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=cloudcover&start_date=${isoDate}&end_date=${isoDate}&timezone=UTC`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: { cloudcover: number[] } };
    const covers = data.hourly?.cloudcover;
    return covers && covers.length === 24 ? covers : null;
  } catch {
    return null;
  }
}
