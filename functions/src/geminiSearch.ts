import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI } from '@google/genai';

export const geminiSearch = onCall(
  { region: 'europe-west1', secrets: ['GEMINI_API_KEY'] },
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

    const prompt = `Recherche des terrasses à "${location}" pour le ${date} vers ${time}.
    Type d'établissement: ${type}.
    Analyse l'ensoleillement (pourcentage de 0 à 100%) selon l'orientation de la rue et l'heure.
    Réponds EXCLUSIVEMENT sous forme de tableau JSON:
    [{"name": "Nom", "address": "Adresse complète", "type": "bar|restaurant|cafe", "sunExposure": 80, "description": "Analyse du soleil", "rating": 4.5, "lat": 48.8, "lng": 2.3}]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response.text || '[]';
    const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
    const results: any[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const groundingChunks = (response.candidates?.[0]?.groundingMetadata?.groundingChunks || []) as any[];
    const sources = groundingChunks
      .map((chunk: any) => (chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null))
      .filter(Boolean);

    return { results, sources };
  }
);
