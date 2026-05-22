// Client-side live sun update for SEO pages.
// Sun math comes from @/lib/sun (shared with the build pipeline) and cloud
// cover from @/lib/weather — no logic is duplicated here anymore.

import { computeSunScore } from '@/lib/sun';
import { fetchCloudCoverFactor, fetchHourlyCloudCover } from '@/lib/weather';
import { isOpenNow } from '@/lib/openingHours';

interface TerraceData {
  element: HTMLElement;
  lat: number;
  lng: number;
  facing: number;
  name: string;
  openingHours: string | null;
}

/** Escape user-controlled text before interpolating into innerHTML. OSM
 *  establishment names are publicly editable and could carry HTML payloads. */
function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

/** sun percentage (0-100) for a terrace at a given moment + cloud factor. */
function sunPercentAt(data: TerraceData, date: Date, cloudCover: number): number {
  return computeSunScore({
    lat: data.lat,
    lng: data.lng,
    date,
    facing: data.facing,
    cloudCover,
  }).sunPercent;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
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
    hours.push({ hour: h, sun: sunPercentAt(data, localDate, cloud), isNow: h === nowHour });
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
  const { sunPercent, sunAltitudeDeg } = computeSunScore({
    lat: data.lat,
    lng: data.lng,
    date: now,
    facing: data.facing,
    cloudCover,
  });
  const liveEl = data.element.querySelector('[data-live-sun]') as HTMLElement | null;
  if (liveEl) {
    if (sunAltitudeDeg <= 0) {
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
  const pcts = terraces.map((t) => sunPercentAt(t, now, cloudCover));
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const max = Math.max(...pcts);
  const maxTerrace = terraces[pcts.indexOf(max)];
  const cloudPct = Math.round(cloudCover * 100);
  const weatherLabel = cloudPct < 20 ? 'ciel dégagé' : cloudPct < 60 ? 'ciel partiellement nuageux' : 'ciel couvert';

  // maxTerrace.name is OSM-sourced — escape before innerHTML interpolation.
  banner.innerHTML = `
    <div class="live-banner-main">
      <strong>${formatTime(now)}</strong> · ${weatherLabel} (${cloudPct}% nuages)
    </div>
    <div class="live-banner-stats">
      Soleil moyen : <strong>${avg}%</strong>
      ${max > 0 ? `· Meilleure terrasse maintenant : <strong>${escapeHtml(maxTerrace.name)}</strong> (${max}%)` : ''}
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

  const hourly = await fetchHourlyCloudCover({ lat: centerLat, lng: centerLng, date: now });
  const cloudCover = hourly
    ? (hourly[now.getUTCHours()] ?? 0) / 100
    : ((await fetchCloudCoverFactor({ lat: centerLat, lng: centerLng, date: now })) ?? 0);

  for (const t of terraces) {
    updateTerrace(t, now, cloudCover);
    if (hourly) {
      const chartEl = t.element.querySelector('[data-hourly-chart]') as HTMLElement | null;
      if (chartEl) renderHourlyChart(chartEl, t, now, hourly);
    }
  }

  if (banner) updateBanner(banner, now, cloudCover, terraces);
}
