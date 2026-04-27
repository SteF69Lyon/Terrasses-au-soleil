import * as SunCalc from 'suncalc';

export interface SunScoreInput {
  lat: number;
  lng: number;
  date: Date;
  /** Degrees the terrace faces (0=N, 90=E, 180=S, 270=W). Default 180 (south). */
  facing?: number;
  /** 0–1 cloud cover factor (1 = overcast). Default 0. */
  cloudCover?: number;
}

export interface SunScoreResult {
  sunPercent: number;
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
  facingDeg: number;
  cloudCover: number;
  explanation: string;
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function cardinalLabel(deg: number): string {
  const dirs = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
  return dirs[Math.round(normalizeAngle(deg) / 45) % 8];
}

export function computeSunScore(input: SunScoreInput): SunScoreResult {
  const facing = normalizeAngle(input.facing ?? 180);
  const cloudCover = Math.max(0, Math.min(1, input.cloudCover ?? 0));

  const pos = SunCalc.getPosition(input.date, input.lat, input.lng);
  const altitudeDeg = (pos.altitude * 180) / Math.PI;
  const sunAzimuthDeg = normalizeAngle((pos.azimuth * 180) / Math.PI + 180);

  if (altitudeDeg <= 0) {
    return {
      sunPercent: 0,
      sunAltitudeDeg: altitudeDeg,
      sunAzimuthDeg,
      facingDeg: facing,
      cloudCover,
      explanation: "Soleil sous l'horizon.",
    };
  }

  let angleDiff = Math.abs(sunAzimuthDeg - facing);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;
  const facingFactor = Math.max(0, Math.cos((angleDiff * Math.PI) / 180));

  const altitudeRad = (altitudeDeg * Math.PI) / 180;
  const altitudeFactor = Math.sin(altitudeRad);

  const clearSky = 1 - cloudCover;
  const sunPercent = Math.round(facingFactor * altitudeFactor * clearSky * 100);

  const cardinal = cardinalLabel(facing);
  const weatherNote = cloudCover < 0.2 ? 'ciel dégagé' : cloudCover < 0.6 ? 'ciel partiellement nuageux' : 'ciel couvert';

  let explanation: string;
  if (cloudCover >= 0.9) {
    explanation = `Ciel couvert, soleil masqué. Terrasse orientée ${cardinal}.`;
  } else if (sunPercent > 65) {
    explanation = `Terrasse orientée ${cardinal}, soleil bien placé (${Math.round(altitudeDeg)}° d'élévation), ${weatherNote}.`;
  } else if (sunPercent > 25) {
    explanation = `Terrasse orientée ${cardinal}, soleil partiellement en face (${Math.round(altitudeDeg)}°), ${weatherNote}.`;
  } else if (sunPercent > 0) {
    explanation = `Terrasse orientée ${cardinal}, soleil bas ou décalé (${Math.round(altitudeDeg)}°), ${weatherNote}.`;
  } else {
    explanation = `Terrasse orientée ${cardinal}, soleil dans le dos (${weatherNote}).`;
  }

  return {
    sunPercent,
    sunAltitudeDeg: altitudeDeg,
    sunAzimuthDeg,
    facingDeg: facing,
    cloudCover,
    explanation,
  };
}
