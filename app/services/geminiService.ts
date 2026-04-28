// @google/genai is dynamic-imported only inside connectLiveAssistant to keep
// it out of the initial bundle (~150 kB saved on first paint).
import { EstablishmentType, SunLevel, Terrace, UserPreferences } from '../types';
import { searchTerraces } from './searchService';
import { dbService } from './dbService';
import { fetchLiveToken } from './liveTokenService';

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
  async findTerraces(
    location: string,
    type: EstablishmentType,
    date: string,
    time: string,
    lat?: number,
    lng?: number
  ): Promise<Terrace[]> {
    const session = (await dbService.getAuth()?.getSession())?.data.session;
    const jwt = session?.access_token;
    const { results, sources } = await searchTerraces({ location, type, date, time, lat, lng }, jwt);

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

  // TTS désactivé pendant la migration Supabase — la Cloud Function geminiTts
  // ne sera pas portée sur Edge Function. Le bouton 🔊 dans TerraceCard catche
  // cette erreur et l'affiche discrètement.
  async speakDescription(_text: string): Promise<null> {
    throw new Error('TTS désactivé pendant la migration Supabase.');
  }

  async connectLiveAssistant(callbacks: LiveAssistantCallbacks, context: LiveAssistantContext) {
    const session = (await dbService.getAuth()?.getSession())?.data.session;
    const jwt = session?.access_token;
    if (!jwt) throw new Error('Connexion requise.');
    const { apiKey } = await fetchLiveToken(jwt);

    // Dynamic import — @google/genai weighs ~150 kB and is only needed when
    // the user actually activates the live voice assistant.
    const { GoogleGenAI, Modality, Type } = await import('@google/genai');
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

    let liveSession: any = null;
    liveSession = await ai.live.connect({
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

                  liveSession.sendToolResponse({
                    functionResponses: [
                      { id: fc.id, name: fc.name, response: { result: summary } },
                    ],
                  });
                } catch (e: any) {
                  liveSession.sendToolResponse({
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

    return liveSession;
  }
}

export const gemini = new GeminiService();
