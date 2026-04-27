import type { Firestore } from 'firebase-admin/firestore';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

export async function getCached<T>(
  db: Firestore,
  collection: string,
  id: string,
  ttlMs: number,
): Promise<T | null> {
  const snap = await db.collection(collection).doc(id).get();
  if (!snap.exists) return null;
  const entry = snap.data() as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > ttlMs) return null;
  return entry.data;
}

export async function setCached<T>(
  db: Firestore,
  collection: string,
  id: string,
  data: T,
): Promise<void> {
  const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
  await db.collection(collection).doc(id).set(entry);
}

export const TTL = {
  OSM: 1000 * 60 * 60 * 24 * 30,
  SUN_SCORE: 1000 * 60 * 60 * 24 * 90,
  INTRO: 1000 * 60 * 60 * 24 * 180,
  FAQ: 1000 * 60 * 60 * 24 * 180,
  CITY_GEO: Number.MAX_SAFE_INTEGER,
} as const;
