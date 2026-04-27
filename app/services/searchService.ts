// services/searchService.ts
//
// Appelle l'Edge Function search-terraces sur Supabase et retourne les résultats
// au même format que l'ancienne Cloud Function geminiSearch.

import { Terrace } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type SearchInput = {
  location: string;
  type: string;
  date: string;
  time: string;
  lat?: number;
  lng?: number;
};

type SearchResponse = {
  results: Array<Partial<Terrace> & { id: string; name: string; lat?: number; lng?: number }>;
  sources: Array<{ title: string; uri: string }>;
  provider?: string;
  model?: string;
};

export async function searchTerraces(input: SearchInput, userJwt?: string): Promise<SearchResponse> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars manquantes.');
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/search-terraces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userJwt ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`search-terraces ${res.status}: ${txt}`);
  }
  return res.json();
}
