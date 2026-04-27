// services/liveTokenService.ts
//
// Récupère la clé Gemini API auprès de l'Edge Function live-token (auth requise).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchLiveToken(userJwt: string): Promise<{ apiKey: string }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars manquantes.');
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/live-token`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userJwt}`,
    },
  });
  if (res.status === 401) throw new Error("Connexion requise pour l'assistant vocal.");
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`live-token ${res.status}: ${txt}`);
  }
  return res.json();
}
