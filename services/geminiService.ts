import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EstablishmentType, SunLevel, Terrace, UserProfile } from "../types";

export class GeminiService {
  // On ne met plus en cache l'instance pour s'assurer de récupérer la clé process.env à chaque appel
  private createAI() {
    try {
      // Sécurisation de l'accès à process pour éviter le crash si non défini
      if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
      }
      return null;
    } catch (e) {
      console.error("Erreur initialisation IA:", e);
      return null;
    }
  }

  async findTerraces(
    location: string, 
    type: EstablishmentType, 
    date: string, 
    time: string,
    lat?: number, 
    lng?: number
  ): Promise<Terrace[]> {
    const ai = this.createAI();
    if (!ai) return [];

    const prompt = `Trouve des terrasses à "${location}" pour le ${date} à ${time}. Type d'établissement souhaité: ${type}.
    Calcule précisément l'ensoleillement en pourcentage (0-100%) selon les ombres portées des bâtiments environnants à cette heure précise.
    Réponds EXCLUSIVEMENT sous forme de tableau JSON valide: 
    [{"name": "Nom", "address": "Adresse", "type": "bar|restaurant|cafe", "sunExposure": 80, "description": "Brève analyse de l'ombre portée", "rating": 4.5, "lat": 48.8, "lng": 2.3}]`;

    try {
      // Maps grounding est supporté uniquement sur la série 2.5
      const response = await ai.models.generateContent({
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

      const text = response.text || "[]";
      // Extraction sécurisée du JSON
      const jsonMatch = text.match(/\[.*\]/s);
      const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      // Extraction obligatoire des sources de grounding pour conformité Google
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks.map((chunk: any) => {
        if (chunk.maps) return { title: chunk.maps.title, uri: chunk.maps.uri };
        if (chunk.web) return { title: chunk.web.title, uri: chunk.web.uri };
        return null;
      }).filter(Boolean);

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
        sources: sources.length > 0 ? sources : undefined
      }));
    } catch (e: any) {
      console.error("IA Search Error:", e?.message || "Échec de l'appel IA");
      return [];
    }
  }

  async speakDescription(text: string) {
    const ai = this.createAI();
    if (!ai) return;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Dis de manière chaleureuse: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64) this.playRawAudio(base64);
    } catch (e: any) {
      console.error("TTS Error:", e?.message);
    }
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
      console.error("Erreur lecture audio");
    }
  }

  async connectLiveAssistant(callbacks: any) {
    const ai = this.createAI();
    if (!ai) throw new Error("IA indisponible");
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "Tu es un expert en terrasses. Aide l'utilisateur à trouver le soleil. Réponds en français.",
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
      }
    });
  }
}

export const gemini = new GeminiService();