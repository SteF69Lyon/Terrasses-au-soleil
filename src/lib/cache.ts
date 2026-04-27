import type { SupabaseClient } from '@supabase/supabase-js';

export interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

/**
 * Read a cache entry from `seo_cache`. Returns null if missing OR stale.
 * Stale = `fetchedAt + ttlMs < now`.
 */
export async function getCached<T>(
  db: SupabaseClient,
  collection: string,
  id: string,
  ttlMs: number,
): Promise<T | null> {
  const { data, error } = await db
    .from('seo_cache')
    .select('data, fetched_at')
    .eq('collection', collection)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  const fetchedAt = new Date(data.fetched_at as string).getTime();
  if (!Number.isFinite(fetchedAt)) return null;
  if (Date.now() - fetchedAt > ttlMs) return null;
  return (data.data as unknown) as T;
}

/**
 * Write/upsert a cache entry. `fetched_at` is set to now() server-side via
 * default value, but we also pass it explicitly so subsequent reads don't
 * depend on clock skew between Postgres and the build runner.
 */
export async function setCached<T>(
  db: SupabaseClient,
  collection: string,
  id: string,
  data: T,
): Promise<void> {
  const { error } = await db.from('seo_cache').upsert(
    {
      collection,
      id,
      data: data as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'collection,id' },
  );
  if (error) throw new Error(`seo_cache upsert failed for ${collection}/${id}: ${error.message}`);
}

export const TTL = {
  OSM: 1000 * 60 * 60 * 24 * 30,
  SUN_SCORE: 1000 * 60 * 60 * 24 * 90,
  INTRO: 1000 * 60 * 60 * 24 * 180,
  FAQ: 1000 * 60 * 60 * 24 * 180,
  CITY_GEO: Number.MAX_SAFE_INTEGER,
} as const;
