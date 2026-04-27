import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

export function hasBuildCredentials(): boolean {
  return (
    Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    Boolean(process.env.GEMINI_BUILD_KEY)
  );
}

/**
 * Returns a Supabase admin client (service role, bypasses RLS).
 * Used by the SEO build pipeline (cache.ts, buildData.ts) on GitHub Actions.
 * The role key MUST be set as a GitHub secret — never bundled to the client.
 */
export function getDb(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase build credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.',
    );
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
