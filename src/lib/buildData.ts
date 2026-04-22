import { getDb } from './firebase';
import { getCached, setCached, TTL } from './cache';
import { geocodeThrottled } from './nominatim';
import { fetchEstablishments, type Establishment } from './overpass';
import { scoreSunExposure, generateIntro, generateFaq, type SunScore, type FaqEntry } from './gemini';
import type { BBox } from './nominatim';
import type { City, Quartier } from '../data/cities';

export interface PageData {
  bbox: BBox;
  establishments: (Establishment & { sun: SunScore | null })[];
  intro: string;
  faq: FaqEntry[];
}

async function getOrFetchBBox(city: City, quartier: Quartier | null): Promise<BBox> {
  const db = getDb();
  const id = quartier ? `${city.slug}-${quartier.slug}` : city.slug;
  const cached = await getCached<BBox>(db, 'cityGeo', id, TTL.CITY_GEO);
  if (cached) return cached;
  const query = quartier ? quartier.searchHint : city.name;
  const bbox = await geocodeThrottled(query);
  await setCached(db, 'cityGeo', id, bbox);
  return bbox;
}

async function getOrFetchEstablishments(pageId: string, bbox: BBox): Promise<Establishment[]> {
  const db = getDb();
  const cached = await getCached<Establishment[]>(db, 'osmCache', pageId, TTL.OSM);
  if (cached) return cached;
  const list = await fetchEstablishments(bbox);
  await setCached(db, 'osmCache', pageId, list);
  return list;
}

async function getOrComputeSunScore(est: Establishment, batchFallback: Map<string, SunScore>): Promise<SunScore | null> {
  const db = getDb();
  const cached = await getCached<SunScore>(db, 'sunScores', encodeURIComponent(est.osmId), TTL.SUN_SCORE);
  if (cached) return cached;
  const fromBatch = batchFallback.get(est.osmId);
  if (fromBatch) {
    await setCached(db, 'sunScores', encodeURIComponent(est.osmId), fromBatch);
    return fromBatch;
  }
  return null;
}

async function getOrGenerateIntro(pageId: string, city: City, quartier: Quartier | null, bbox: BBox): Promise<string> {
  const db = getDb();
  const cached = await getCached<string>(db, 'pageIntros', pageId, TTL.INTRO);
  if (cached) return cached;
  const centerLat = (bbox.north + bbox.south) / 2;
  const centerLng = (bbox.east + bbox.west) / 2;
  const intro = await generateIntro({
    ville: city.name,
    quartier: quartier?.name ?? null,
    lat: centerLat,
    lng: centerLng,
  });
  await setCached(db, 'pageIntros', pageId, intro);
  return intro;
}

async function getOrGenerateFaq(pageId: string, city: City, quartier: Quartier | null): Promise<FaqEntry[]> {
  const db = getDb();
  const cached = await getCached<FaqEntry[]>(db, 'pageFaqs', pageId, TTL.FAQ);
  if (cached) return cached;
  const faq = await generateFaq({ ville: city.name, quartier: quartier?.name ?? null });
  await setCached(db, 'pageFaqs', pageId, faq);
  return faq;
}

export async function buildPageData(city: City, quartier: Quartier | null): Promise<PageData> {
  const pageId = quartier ? `${city.slug}-${quartier.slug}` : city.slug;
  const bbox = await getOrFetchBBox(city, quartier);
  const all = await getOrFetchEstablishments(pageId, bbox);

  const withSeating = all.filter((e) => e.outdoorSeating);
  const pool = withSeating.length >= 10 ? withSeating : all;
  const top = pool.slice(0, 15);

  const missing: Establishment[] = [];
  const batchFallback = new Map<string, SunScore>();
  const db = getDb();
  for (const e of top) {
    const cached = await getCached<SunScore>(db, 'sunScores', encodeURIComponent(e.osmId), TTL.SUN_SCORE);
    if (!cached) missing.push(e);
  }
  if (missing.length > 0) {
    const scores = await scoreSunExposure(missing);
    for (const s of scores) batchFallback.set(s.osmId, s);
  }

  const enriched = await Promise.all(
    top.map(async (e) => ({ ...e, sun: await getOrComputeSunScore(e, batchFallback) })),
  );

  const intro = await getOrGenerateIntro(pageId, city, quartier, bbox);
  const faq = await getOrGenerateFaq(pageId, city, quartier);

  return { bbox, establishments: enriched, intro, faq };
}
