import SunCalc from 'suncalc';
import { isOpenNow } from '@/lib/openingHours';

interface TerraceData {
  element: HTMLElement;
  lat: number;
  lng: number;
  facing: number;
  name: string;
  openingHours: string | null;
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function computeSunPercent(lat: number, lng: number, date: Date, facing: number, cloudCover: number): {
  sunPercent: number;
  altitudeDeg: number;
  azimuthDeg: number;
} {
  const pos = SunCalc.getPosition(date, lat, lng);
  const altitudeDeg = (pos.altitude * 180) / Math.PI;
  const azimuthDeg = normalizeAngle((pos.azimuth * 180) / Math.PI + 180);

  if (altitudeDeg <= 0) {
    return { sunPercent: 0, altitudeDeg, azimuthDeg };
  }

  let angleDiff = Math.abs(azimuthDeg - facing);
  if (angleDiff > 180) angleDiff = 360 - angleDiff;
  const facingFactor = Math.max(0, Math.cos((angleDiff * Math.PI) / 180));
  const altitudeFactor = Math.sin((altitudeDeg * Math.PI) / 180);
  const clearSky = 1 - Math.max(0, Math.min(1, cloudCover));

  const sunPercent = Math.round(facingFactor * altitudeFactor * clearSky * 100);
  return { sunPercent, altitudeDeg, azimuthDeg };
}

async function fetchCloudCover(lat: number, lng: number, date: Date): Promise<number | null> {
  const isoDate = date.toISOString().split('T')[0];
  const targetHourUtc = date.getUTCHours();
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=cloudcover&start_date=${isoDate}&end_date=${isoDate}&timezone=UTC`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { hourly?: { cloudcover: number[] } };
    const covers = data.hourly?.cloudcover;
    if (!covers) return null;
    const pct = covers[targetHourUtc];
    return typeof pct === 'number' ? pct / 100 : null;
  } catch {
    return null;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}

async function fetchHourlyCloudCover(lat: number, lng: number, date: Date): Promise<number[] | null> {
  const isoDate = date.toISOString().split('T')[0];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
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

const HOURLY_START = 9;
const HOURLY_END = 21;

function renderHourlyChart(container: HTMLElement, data: TerraceData, day: Date, hourlyCloud: number[]) {
  const hours: { hour: number; sun: number; isNow: boolean }[] = [];
  const nowHour = day.getHours();

  for (let h = HOURLY_START; h <= HOURLY_END; h++) {
    const localDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0, 0);
    const utcHour = localDate.getUTCHours();
    const cloud = (hourlyCloud[utcHour] ?? 0) / 100;
    const { sunPercent } = computeSunPercent(data.lat, data.lng, localDate, data.facing, cloud);
    hours.push({ hour: h, sun: sunPercent, isNow: h === nowHour });
  }

  const maxSun = Math.max(1, ...hours.map((h) => h.sun));
  const bars = hours
    .map((h) => {
      const heightPct = Math.round((h.sun / maxSun) * 100);
      const colorClass = h.sun >= 65 ? 'bar--high' : h.sun >= 25 ? 'bar--mid' : 'bar--low';
      const nowClass = h.isNow ? ' hourly-bar--now' : '';
      return `<div class="hourly-bar${nowClass}" title="${h.hour}h : ${h.sun}% soleil">
        <div class="hourly-fill ${colorClass}" style="height:${heightPct}%"></div>
        <div class="hourly-label">${h.hour}h</div>
      </div>`;
    })
    .join('');

  container.innerHTML = `<div class="hourly-title">Prévision du soleil aujourd'hui (heure locale)</div><div class="hourly-bars">${bars}</div>`;
  container.hidden = false;
}

function updateTerrace(data: TerraceData, now: Date, cloudCover: number) {
  const { sunPercent, altitudeDeg } = computeSunPercent(data.lat, data.lng, now, data.facing, cloudCover);
  const liveEl = data.element.querySelector('[data-live-sun]') as HTMLElement | null;
  if (liveEl) {
    if (altitudeDeg <= 0) {
      liveEl.textContent = 'Soleil couché';
      liveEl.classList.add('live-sun--night');
    } else {
      liveEl.textContent = `Maintenant : ☀️ ${sunPercent}%`;
      liveEl.classList.remove('live-sun--night');
      liveEl.dataset.pct = String(sunPercent);
      if (sunPercent >= 65) liveEl.classList.add('live-sun--high');
      else if (sunPercent >= 25) liveEl.classList.add('live-sun--mid');
      else liveEl.classList.add('live-sun--low');
    }
  }

  // Open / closed status from opening_hours tag
  const openEl = data.element.querySelector('[data-open-status]') as HTMLElement | null;
  if (openEl) {
    const openNow = isOpenNow(data.openingHours, now);
    if (openNow === true) {
      openEl.textContent = '✓ Ouvert';
      openEl.classList.add('open-status--open');
    } else if (openNow === false) {
      openEl.textContent = '✗ Fermé';
      openEl.classList.add('open-status--closed');
    }
    // null → leave empty (hidden by :empty CSS rule)
  }
}

function updateBanner(
  banner: HTMLElement,
  now: Date,
  cloudCover: number,
  terraces: TerraceData[],
) {
  if (!terraces.length) return;
  const pcts = terraces.map((t) => computeSunPercent(t.lat, t.lng, now, t.facing, cloudCover).sunPercent);
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const max = Math.max(...pcts);
  const maxTerrace = terraces[pcts.indexOf(max)];
  const cloudPct = Math.round(cloudCover * 100);
  const weatherLabel = cloudPct < 20 ? 'ciel dégagé' : cloudPct < 60 ? 'ciel partiellement nuageux' : 'ciel couvert';

  banner.innerHTML = `
    <div class="live-banner-main">
      <strong>${formatTime(now)}</strong> · ${weatherLabel} (${cloudPct}% nuages)
    </div>
    <div class="live-banner-stats">
      Soleil moyen : <strong>${avg}%</strong>
      ${max > 0 ? `· Meilleure terrasse maintenant : <strong>${maxTerrace.name}</strong> (${max}%)` : ''}
    </div>
  `;
  banner.hidden = false;
}

export async function initLiveSun() {
  const banner = document.querySelector('[data-live-banner]') as HTMLElement | null;
  const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-terrace]'));
  if (!cards.length) return;

  const terraces: TerraceData[] = cards
    .map((el) => ({
      element: el,
      lat: Number(el.dataset.lat),
      lng: Number(el.dataset.lng),
      facing: Number(el.dataset.facing ?? 180),
      name: el.dataset.name ?? '',
      openingHours: el.dataset.openingHours || null,
    }))
    .filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng));

  if (!terraces.length) return;

  const centerLat = terraces.reduce((a, t) => a + t.lat, 0) / terraces.length;
  const centerLng = terraces.reduce((a, t) => a + t.lng, 0) / terraces.length;
  const now = new Date();

  const hourly = await fetchHourlyCloudCover(centerLat, centerLng, now);
  const cloudCover = hourly ? (hourly[now.getUTCHours()] ?? 0) / 100 : ((await fetchCloudCover(centerLat, centerLng, now)) ?? 0);

  for (const t of terraces) {
    updateTerrace(t, now, cloudCover);
    if (hourly) {
      const chartEl = t.element.querySelector('[data-hourly-chart]') as HTMLElement | null;
      if (chartEl) renderHourlyChart(chartEl, t, now, hourly);
    }
  }

  if (banner) updateBanner(banner, now, cloudCover, terraces);
}
