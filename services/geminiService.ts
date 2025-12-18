
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EstablishmentType, SunLevel, Terrace, UserProfile } from "../types";

export class GeminiService {
  /**
   * Helper to get a fresh instance of GoogleGenAI.
   * Creating a new instance right before use ensures we use the correct API key from process.env.
   */
  private get ai(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: process.env.API_KEY! });
  }

  /**
   * Finds terraces using Google Maps grounding and Google Search for weather.
   */
  async findTerraces(
    location: string, 
    type: EstablishmentType, 
    date: string, 
    time: string,
    lat?: number, 
    lng?: number
  ): Promise<Terrace[]> {
    
    // Prompt optimisé pour la planification temporelle
    const prompt = `Tu es un expert en géométrie urbaine et météorologie. 
    Localisation: "${location}"
    Type d'établissement: "${type}"
    Date cible: ${date}
    Heure cible: ${time}

    INSTRUCTIONS:
    1. Utilise Google Search pour vérifier les PRÉVISIONS météo à "${location}" pour le ${date}.
    2. Utilise Google Maps pour trouver des établissements (bar, restaurant, café, hôtel) avec terrasse dans cette zone.
    3. Calcule l'exposition au soleil (0-100%) précisément pour le ${date} à ${time} :
       - Calcule la position du soleil (azimut et élévation) à cette heure précise.
       - Analyse l'orientation des rues et la hauteur des bâtiments.
       - Détermine si la terrasse sera dans l'ombre portée des immeubles ou en plein soleil.
    
    RÈGLE D'OR: Ne réponds jamais par du texte conversationnel. Renvoie UNIQUEMENT un tableau JSON structuré:
    [
      {
        "name": "Nom",
        "address": "Adresse",
        "type": "bar|restaurant|cafe|hôtel",
        "sunExposure": 85,
        "description": "Pourquoi est-ce ensoleillé à ${time} ? (ex: soleil bas d'hiver, rue large orientée sud-ouest)",
        "rating": 4.5,
        "lat": 0.0,
        "lng": 0.0
      }
    ]`;

    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: lat && lng ? { latitude: lat, longitude: lng } : undefined
          }
        }
      }
    });

    const responseText = response.text || "";
    let results = [];
    
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      } else {
        const trimmed = responseText.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          results = JSON.parse(trimmed);
        } else {
          return [];
        }
      }
    } catch (e) {
      console.error("Erreur de parsing:", e);
      return [];
    }
    
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map(c => {
      if (c.maps) return { title: c.maps.title || "Google Maps", uri: c.maps.uri || "" };
      if (c.web) return { title: c.web.title || "Lien Web", uri: c.web.uri || "" };
      return null;
    }).filter((s): s is { title: string; uri: string } => s !== null && s.uri !== "");

    return results.map((r: any, index: number) => ({
      id: `${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: r.name,
      address: r.address,
      type: (r.type || type) as EstablishmentType,
      sunExposure: r.sunExposure || 0,
      sunLevel: r.sunExposure > 65 ? SunLevel.FULL : r.sunExposure > 25 ? SunLevel.PARTIAL : SunLevel.SHADED,
      description: r.description || "Estimation basée sur les trajectoires solaires prévues.",
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(r.name)}/400/300`,
      rating: r.rating || 4.0,
      coordinates: { lat: r.lat || 0, lng: r.lng || 0 },
      sources: sources
    }));
  }

  async generateForecastEmail(profile: UserProfile, favorites: Terrace[]): Promise<string> {
    const prompt = `Génère le corps d'un email amical pour ${profile.name} (${profile.email}).
    L'email concerne les prévisions d'ensoleillement du jour pour ses terrasses favorites suivantes :
    ${favorites.map(f => `- ${f.name} (${f.address})`).join('\n')}
    
    Le ton doit être chaleureux, "lifestyle". Indique des créneaux horaires optimaux.
    Termine par une signature "L'équipe SoleilTerrasse".`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Désolé, impossible de générer les prévisions.";
  }

  async speakDescription(text: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Lis ceci avec enthousiasme : ${text}` }] }],
      config: {
        // Fix: corrected typo 'responseModalalities' to 'responseModalities'
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      this.playRawAudio(base64Audio);
    }
  }

  private async playRawAudio(base64: string) {
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
  }

  async connectLiveAssistant(callbacks: any) {
    return this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        // Fix: corrected typo 'responseModalalities' to 'responseModalities'
        responseModalities: [Modality.AUDIO],
        systemInstruction: "Tu es un assistant expert en terrasses ensoleillées. Aide l'utilisateur à planifier son moment au soleil. Parle français.",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        }
      }
    });
  }
}

export const gemini = new GeminiService();
