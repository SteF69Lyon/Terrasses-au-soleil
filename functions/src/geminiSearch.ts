import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';

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

    const ai = new GoogleGenAI({ apiKey });

    const typeFilter = type === 'all' ? 'bars, restaurants, cafés et hôtels' : `${type}s`;
    const prompt = `Recherche TOUS les ${typeFilter} avec terrasse à "${location}" pour le ${date} vers ${time}.
Sois exhaustif : liste tous les établissements ouverts que tu peux identifier dans cette zone, jusqu'à 30 résultats. Ne te limite pas à quelques suggestions.

Pour chacun :
- Analyse l'ensoleillement de la terrasse à cette heure précise (0 à 100%) en tenant compte de l'orientation de la rue, de la hauteur du soleil à cette date et heure à cette latitude, et de l'ombre portée des bâtiments.
- Rédige une courte description (1 phrase, axée soleil/ambiance).
- Indique la note Google Maps si tu la connais, sinon 4.0 par défaut.
- Donne les coordonnées lat/lng aussi précises que possible.

Réponds EXCLUSIVEMENT sous forme de tableau JSON valide, sans texte avant ni après :
[{"name":"...","address":"...","type":"bar|restaurant|cafe|hôtel","sunExposure":80,"description":"...","rating":4.5,"lat":48.8,"lng":2.3}]`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 8192,
        },
      });

      const text = response.text || '[]';
      const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);

      let results: any[] = [];
      if (jsonMatch) {
        try {
          results = JSON.parse(jsonMatch[0]);
        } catch {
          throw new HttpsError('internal', 'La réponse Gemini ne contient pas de JSON valide.');
        }
      }

      const groundingChunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as any[];
      const sources = groundingChunks
        .map((chunk: any) => (chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null))
        .filter(Boolean);

      return { results, sources };
    } catch (e: any) {
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('unavailable', 'Service Gemini temporairement indisponible.');
    }
  }
);
