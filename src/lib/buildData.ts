import { getDb } from './firebase';
import { getCached, setCached, TTL } from './cache';
import { geocodeThrottled } from './nominatim';
import { fetchEstablishments, type Establishment } from './overpass';
import { generateIntro, generateFaq, type FaqEntry } from './gemini';
import { scoreEstablishment, SEO_REFERENCE_DATE, type SunScore } from './sun';
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

const MAX_CACHED_ESTABLISHMENTS = 100;

async function getOrFetchEstablishments(pageId: string, bbox: BBox): Promise<Establishment[]> {
  const db = getDb();
  const cached = await getCached<Establishment[]>(db, 'osmCache', pageId, TTL.OSM);
  if (cached) return cached;
  const all = await fetchEstablishments(bbox);
  const withSeating = all.filter((e) => e.outdoorSeating);
  const without = all.filter((e) => !e.outdoorSeating);
  const trimmed = [...withSeating, ...without].slice(0, MAX_CACHED_ESTABLISHMENTS);
  await setCached(db, 'osmCache', pageId, trimmed);
  return trimmed;
}

async function getOrComputeSunScore(est: Establishment): Promise<SunScore> {
  const db = getDb();
  // Prefix "d1_" (deterministic v1) invalides the previous Gemini-generated cache entries.
  const cacheId = encodeURIComponent(`d1_${est.osmId}`);
  const cached = await getCached<SunScore>(db, 'sunScores', cacheId, TTL.SUN_SCORE);
  if (cached) return cached;
  const score = scoreEstablishment(est, SEO_REFERENCE_DATE);
  await setCached(db, 'sunScores', cacheId, score);
  return score;
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

  const enriched = await Promise.all(
    top.map(async (e) => ({ ...e, sun: await getOrComputeSunScore(e) })),
  );

  const intro = await getOrGenerateIntro(pageId, city, quartier, bbox);
  const faq = await getOrGenerateFaq(pageId, city, quartier);

  return { bbox, establishments: enriched, intro, faq };
}
