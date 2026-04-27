import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';
import { computeSunScore } from './sun';
import { fetchCloudCoverFactor } from './weather';

interface RawEstablishment {
  name: string;
  address: string;
  type: string;
  rating?: number;
  lat: number;
  lng: number;
}

export const geminiSearch = onCall(
  { region: 'europe-west1', secrets: ['GEMINI_API_KEY'], invoker: 'public' },
  async (request) => {
    const { location, type, date, time, lat, lng } = request.data as {
      location: string;
      type: string;
      date: string;
      time: string;
      lat?: number;
      lng?: number;
    };

    if (!location || !type || !date || !time) {
      throw new HttpsError('invalid-argument', 'Paramètres manquants : location, type, date, time requis.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Clé API non configurée.');
    }

    const targetDate = parseUserDateTime(date, time);
    if (!targetDate) {
      throw new HttpsError('invalid-argument', 'Format date/heure invalide.');
    }

    const ai = new GoogleGenAI({ apiKey });

    const typeFilter = type === 'all' ? 'bars, restaurants, cafés et hôtels' : `${type}s`;
    const prompt = `Recherche TOUS les ${typeFilter} avec terrasse à "${location}".
Sois exhaustif : liste tous les établissements ouverts que tu peux identifier dans cette zone, jusqu'à 30 résultats. Ne te limite pas à quelques suggestions.

Pour chacun, fournis :
- name : nom de l'établissement
- address : adresse complète postale
- type : bar | restaurant | cafe | hôtel
- rating : note Google Maps (nombre décimal), 4.0 si inconnu
- lat / lng : coordonnées GPS aussi précises que possible

N'invente AUCUNE donnée d'ensoleillement : ce sera calculé en dehors.

Réponds EXCLUSIVEMENT sous forme de tableau JSON valide, sans texte avant ni après :
[{"name":"...","address":"...","type":"bar","rating":4.5,"lat":48.8,"lng":2.3}]`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 8192,
        },
      });
    } catch (e: any) {
      console.error('[geminiSearch] Gemini API error:', e?.message ?? e);
      throw new HttpsError('unavailable', `Service Gemini indisponible : ${e?.message ?? 'inconnu'}`);
    }

    const text = response.text || '';
    const jsonStr = extractJsonArray(text);
    let raw: RawEstablishment[] = [];
    if (jsonStr) {
      try {
        raw = JSON.parse(jsonStr);
        if (!Array.isArray(raw)) raw = [];
      } catch (e: any) {
        console.error(
          `[geminiSearch] JSON parse failed (len=${jsonStr.length}). Head: ${jsonStr.slice(0, 300)} | Tail: ${jsonStr.slice(-150)}`,
        );
        throw new HttpsError('internal', "La réponse Gemini n'est pas un JSON valide.");
      }
    } else {
      console.warn('[geminiSearch] No JSON array in Gemini response. Text head:', text.slice(0, 300));
    }

    // Keep only entries with valid numeric coordinates — skip Gemini hallucinations.
    const valid = raw.filter(
      (r) =>
        r &&
        typeof r.name === 'string' && r.name.length > 0 &&
        typeof r.lat === 'number' && Number.isFinite(r.lat) &&
        typeof r.lng === 'number' && Number.isFinite(r.lng),
    );

    if (valid.length === 0) {
      console.warn(`[geminiSearch] No valid results for location="${location}" type="${type}". Raw count: ${raw.length}.`);
      return { results: [], sources: [] };
    }

    const groundingChunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as any[];
    const sources = groundingChunks
      .map((chunk: any) => (chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null))
      .filter(Boolean);

    const zoneLat = lat ?? averageLat(valid);
    const zoneLng = lng ?? averageLng(valid);
    const cloudCover = zoneLat != null && zoneLng != null
      ? await fetchCloudCoverFactor({ lat: zoneLat, lng: zoneLng, date: targetDate }).catch(() => null)
      : null;

    const results = valid.map((r) => {
      let sunExposure = 0;
      let description = '';
      try {
        const score = computeSunScore({
          lat: r.lat,
          lng: r.lng,
          date: targetDate,
          cloudCover: cloudCover ?? 0,
        });
        sunExposure = score.sunPercent;
        description = score.explanation;
      } catch (e: any) {
        console.warn(`[geminiSearch] Sun score failed for ${r.name}:`, e?.message ?? e);
      }
      return {
        name: r.name,
        address: r.address,
        type: r.type,
        rating: typeof r.rating === 'number' ? r.rating : 4.0,
        lat: r.lat,
        lng: r.lng,
        sunExposure,
        description,
      };
    });

    results.sort((a, b) => b.sunExposure - a.sunExposure);

    return { results, sources };
  },
);

/**
 * Extracts the first JSON array substring from an arbitrary text blob.
 * Robust against :
 *   - markdown code fences (```json ... ```)
 *   - prose before/after the array (grounding citations, commentary)
 *   - stray [ or ] characters inside strings
 * Returns null if no balanced JSON array can be found.
 */
function extractJsonArray(raw: string): string | null {
  // Remove common markdown fences so the bracket scan sees the JSON cleanly.
  const text = raw.replace(/```(?:json)?/gi, '');
  const start = text.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseUserDateTime(date: string, time: string): Date | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  const d = new Date(`${date}T${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function averageLat(list: RawEstablishment[]): number | null {
  const valid = list.filter((e) => typeof e.lat === 'number');
  if (!valid.length) return null;
  return valid.reduce((a, e) => a + e.lat, 0) / valid.length;
}

function averageLng(list: RawEstablishment[]): number | null {
  const valid = list.filter((e) => typeof e.lng === 'number');
  if (!valid.length) return null;
  return valid.reduce((a, e) => a + e.lng, 0) / valid.length;
}
