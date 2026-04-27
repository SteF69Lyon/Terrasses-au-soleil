import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { EstablishmentType, SunLevel, Terrace, UserPreferences } from '../types';

const REGION = 'europe-west1';

export interface LiveAssistantContext {
  terraces: Terrace[];
  preferences: UserPreferences;
  locationHint: string;
  displayDateLabel: string;
}

export interface LiveAssistantCallbacks {
  onopen: () => void;
  onmessage: (message: any) => void;
  onerror: (error: any) => void;
  onclose: () => void;
  onTerracesUpdated?: (terraces: Terrace[]) => void;
}

export class GeminiService {
  private fns() {
    return getFunctions(getApp(), REGION);
  }

  async findTerraces(
    location: string,
    type: EstablishmentType,
    date: string,
    time: string,
    lat?: number,
    lng?: number
  ): Promise<Terrace[]> {
    const searchFn = httpsCallable(this.fns(), 'geminiSearch');
    const result = await searchFn({ location, type, date, time, lat, lng });
    const { results, sources } = result.data as { results: any[]; sources: any[] };

    return results.map((r: any, i: number) => ({
      id: `${i}-${Date.now()}`,
      name: r.name,
      address: r.address,
      type: (r.type || type) as EstablishmentType,
      sunExposure: r.sunExposure || 0,
      sunLevel: r.sunExposure > 65 ? SunLevel.FULL : r.sunExposure > 25 ? SunLevel.PARTIAL : SunLevel.SHADED,
      description: r.description || "Analyse d'ensoleillement par IA.",
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(r.name)}/400/300`,
      rating: r.rating || 4.0,
      coordinates: { lat: r.lat || 48.8566, lng: r.lng || 2.3522 },
      sources: sources.length > 0 ? sources : undefined,
    }));
  }

  async speakDescription(text: string) {
    try {
      const ttsFn = httpsCallable(this.fns(), 'geminiTts');
      const result = await ttsFn({ text });
      const { audio } = result.data as { audio: string | null };
      if (audio) this.playRawAudio(audio);
    } catch (e: any) {
      console.error('TTS Error:', e?.message);
    }
  }

  async connectLiveAssistant(callbacks: LiveAssistantCallbacks, context: LiveAssistantContext) {
    const tokenFn = httpsCallable(this.fns(), 'geminiLiveToken');
    const result = await tokenFn({});
    const { apiKey } = result.data as { apiKey: string };

    const ai = new GoogleGenAI({ apiKey });

    const terracesSummary = context.terraces.length === 0
      ? '(aucune terrasse affichée actuellement)'
      : context.terraces
          .map(
            (t, i) =>
              `${i + 1}. "${t.name}" — ${t.address} — ${t.type} — ${t.sunExposure}% de soleil (${t.sunLevel}) — note ${t.rating}/5. ${t.description}`
          )
          .join('\n');

    const systemInstruction = `Tu es un assistant vocal expert en terrasses ensoleillées en France. Réponds TOUJOURS en français, de façon concise et chaleureuse (1 à 3 phrases max).

CONTEXTE DE LA RECHERCHE ACTUELLE :
- Date : ${context.preferences.date} (${context.displayDateLabel})
- Heure : ${context.preferences.time}
- Zone recherchée : ${context.locationHint || 'non précisée'}
- Type filtré : ${context.preferences.type}
- Ensoleillement minimum demandé : ${context.preferences.minSunExposure}%

TERRASSES ACTUELLEMENT AFFICHÉES À L'UTILISATEUR :
${terracesSummary}

RÈGLES :
1. Quand l'utilisateur pose une question sur les résultats visibles ("laquelle est la plus au soleil ?", "laquelle tu recommandes ?", "quelle adresse ?"), réponds UNIQUEMENT à partir de la liste ci-dessus.
2. Quand l'utilisateur demande à chercher ailleurs (autre ville, quartier, type d'établissement, autre date/heure), appelle OBLIGATOIREMENT la fonction search_terraces avec les bons paramètres. Ne jamais inventer de terrasses.
3. Après un appel à search_terraces, annonce brièvement combien de résultats ont été trouvés et cite les 2-3 plus ensoleillés.
4. Si la liste est vide et que l'utilisateur n'a pas précisé où chercher, demande-lui la ville ou le quartier.`;

    const functionDeclarations = [
      {
        name: 'search_terraces',
        description:
          "Recherche de nouvelles terrasses selon des critères donnés. À appeler dès que l'utilisateur demande une autre ville, un autre quartier, un autre type d'établissement, ou une autre date/heure.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            location: {
              type: Type.STRING,
              description: 'Ville, quartier ou adresse en France (ex: "Paris 11e", "Lyon Croix-Rousse")',
            },
            type: {
              type: Type.STRING,
              description: "Type d'établissement : bar, restaurant, cafe, hôtel, ou all",
            },
            date: {
              type: Type.STRING,
              description: 'Date au format YYYY-MM-DD (optionnel, défaut = date de la recherche courante)',
            },
            time: {
              type: Type.STRING,
              description: 'Heure HH:MM (optionnel, défaut = heure de la recherche courante)',
            },
          },
          required: ['location'],
        },
      },
    ];

    let session: any = null;
    session = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: callbacks.onopen,
        onerror: callbacks.onerror,
        onclose: callbacks.onclose,
        onmessage: async (message: any) => {
          const functionCalls = message.toolCall?.functionCalls;
          if (functionCalls?.length) {
            for (const fc of functionCalls) {
              if (fc.name === 'search_terraces') {
                const args = (fc.args || {}) as {
                  location?: string;
                  type?: string;
                  date?: string;
                  time?: string;
                };
                try {
                  const results = await this.findTerraces(
                    args.location || context.locationHint || 'Paris',
                    (args.type as EstablishmentType) || context.preferences.type,
                    args.date || context.preferences.date,
                    args.time || context.preferences.time
                  );
                  callbacks.onTerracesUpdated?.(results);

                  const summary =
                    results.length === 0
                      ? "Aucune terrasse trouvée pour cette recherche."
                      : `${results.length} terrasse(s) trouvée(s). Les plus ensoleillées : ` +
                        results
                          .slice()
                          .sort((a, b) => b.sunExposure - a.sunExposure)
                          .slice(0, 3)
                          .map((t) => `${t.name} (${t.sunExposure}% soleil, ${t.address})`)
                          .join(' ; ');

                  session.sendToolResponse({
                    functionResponses: [
                      { id: fc.id, name: fc.name, response: { result: summary } },
                    ],
                  });
                } catch (e: any) {
                  session.sendToolResponse({
                    functionResponses: [
                      {
                        id: fc.id,
                        name: fc.name,
                        response: { result: `Erreur de recherche : ${e?.message || 'inconnue'}` },
                      },
                    ],
                  });
                }
              }
            }
            return;
          }
          callbacks.onmessage(message);
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
        tools: [{ functionDeclarations }],
      },
    });

    return session;
  }

  private async playRawAudio(base64: string) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.error('Erreur lecture audio');
    }
  }
}

export const gemini = new GeminiService();
