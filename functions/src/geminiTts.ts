import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { GoogleGenAI, Modality } from '@google/genai';

export const geminiTts = onCall(
  { region: 'europe-west1', secrets: ['GEMINI_API_KEY'] },
  async (request) => {
    const { text } = request.data as { text: string };

    if (!text) {
      throw new HttpsError('invalid-argument', 'Paramètre text manquant.');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError('internal', 'Clé API non configurée.');
    }

    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: `Dis de manière chaleureuse: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });

      const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? null;
      if (!audio) {
        throw new HttpsError('internal', 'Aucune donnée audio reçue de Gemini TTS.');
      }
      return { audio };
    } catch (e: any) {
      if (e instanceof HttpsError) throw e;
      throw new HttpsError('unavailable', 'Service TTS temporairement indisponible.');
    }
  }
);
