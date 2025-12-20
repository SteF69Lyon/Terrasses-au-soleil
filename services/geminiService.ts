import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EstablishmentType, SunLevel, Terrace, UserProfile } from "../types";

export class GeminiService {
  private createAI() {
    try {
      // Vérification explicite pour le débogage en production
      // On regarde process.env standard ET window.process.env au cas où le polyfill ou le shim diffère
      const apiKey = process.env.API_KEY || (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY);
      
      if (!apiKey) {
        console.warn("GeminiService: API_KEY manquante - Passage en mode Démo (Mock Data)");
        return null;
      }
      return new GoogleGenAI({ apiKey });
    } catch (e) {
      console.error("GeminiService: Erreur d'initialisation:", e);
      return null;
    }
  }

  private getMockTerraces(type: EstablishmentType): Terrace[] {
    const mocks: Terrace[] = [
      {
        id: 'demo-1',
        name: 'Le Café du Soleil (Démo)',
        address: '12 Place du Panthéon, 75005 Paris',
        type: EstablishmentType.CAFE,
        sunExposure: 95,
        sunLevel: SunLevel.FULL,
        description: "Simulation: Terrasse emblématique exposée plein sud. L'IA détecterait ici une absence d'ombre portée significative. (Mode Démo)",
        imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=600&auto=format&fit=crop',
        rating: 4.8,
        coordinates: { lat: 48.8462, lng: 2.3461 }
      },
      {
        id: 'demo-2',
        name: 'Bistro des Amis (Démo)',
        address: 'Rue Mouffetard, 75005 Paris',
        type: EstablishmentType.RESTAURANT,
        sunExposure: 65,
        sunLevel: SunLevel.PARTIAL,
        description: "Simulation: Ensoleillement partiel dû aux bâtiments hauts côté ouest. Idéal pour le déjeuner. (Mode Démo)",
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop',
        rating: 4.5,
        coordinates: { lat: 48.8421, lng: 2.3492 }
      },
      {
        id: 'demo-3',
        name: 'Rooftop Saint-Michel (Démo)',
        address: 'Boulevard Saint-Michel, 75006 Paris',
        type: EstablishmentType.BAR,
        sunExposure: 100,
        sunLevel: SunLevel.FULL,
        description: "Simulation: Vue dégagée sur les toits, ensoleillement maximal garanti toute la journée. (Mode Démo)",
        imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=600&auto=format&fit=crop',
        rating: 4.9,
        coordinates: { lat: 48.8500, lng: 2.3410 }
      },
      {
        id: 'demo-4',
        name: 'L\'Ombre Paisible (Démo)',
        address: 'Rue des Ecoles, 75005 Paris',
        type: EstablishmentType.CAFE,
        sunExposure: 20,
        sunLevel: SunLevel.SHADED,
        description: "Simulation: Zone ombragée agréable lors des fortes chaleurs. (Mode Démo)",
        imageUrl: 'https://images.unsplash.com/photo-1485182708500-e8f1f318ba72?q=80&w=600&auto=format&fit=crop',
        rating: 4.0,
        coordinates: { lat: 48.8490, lng: 2.3480 }
      }
    ];

    if (type === EstablishmentType.ALL) return mocks;
    return mocks.filter(m => m.type === type);
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
    if (!ai) {
      // Au lieu de lever une erreur bloquante, on retourne des données fictives pour permettre l'usage de l'UI
      console.warn("Utilisation des données Mock (Mode Démo) suite à l'absence de clé API.");
      await new Promise(resolve => setTimeout(resolve, 800)); // Simuler un délai réseau
      return this.getMockTerraces(type);
    }

    const prompt = `Trouve des terrasses à "${location}" pour le ${date} à ${time}. Type d'établissement souhaité: ${type}.
    Calcule précisément l'ensoleillement en pourcentage (0-100%) selon les ombres portées des bâtiments environnants à cette heure précise.
    Réponds EXCLUSIVEMENT sous forme de tableau JSON valide: 
    [{"name": "Nom", "address": "Adresse", "type": "bar|restaurant|cafe", "sunExposure": 80, "description": "Brève analyse de l'ombre portée", "rating": 4.5, "lat": 48.8, "lng": 2.3}]`;

    try {
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
      const jsonMatch = text.match(/\[.*\]/s);
      const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
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
      console.error("GeminiService Search Error:", e?.message || e);
      // Fallback silencieux en cas d'erreur API
      return this.getMockTerraces(type);
    }
  }

  async speakDescription(text: string) {
    const ai = this.createAI();
    if (!ai) return; // Silent fail for TTS
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
    if (!ai) throw new Error("IA indisponible (Clé manquante)");
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