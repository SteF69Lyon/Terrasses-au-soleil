
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EstablishmentType, SunLevel, Terrace, UserProfile } from "../types";

export class GeminiService {
  private get ai(): GoogleGenAI | null {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        console.warn("Clé API Gemini non détectée dans l'environnement.");
        return null;
      }
      return new GoogleGenAI({ apiKey });
    } catch (e) {
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
    const model = this.ai;
    if (!model) {
      console.error("L'IA n'est pas initialisée.");
      return [];
    }

    const prompt = `Trouve des terrasses à "${location}" pour le ${date} à ${time}. Type: ${type}.
    Calcule l'ensoleillement en % selon les ombres portées des bâtiments environnants à cette heure précise.
    Réponds uniquement un tableau JSON : [{"name": "Nom", "address": "Adresse", "type": "bar|restaurant", "sunExposure": 80, "description": "Texte court", "rating": 4.5, "lat": 48.8, "lng": 2.3}]`;

    try {
      const response = await model.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }, { googleSearch: {} }],
          toolConfig: { retrievalConfig: { latLng: lat && lng ? { latitude: lat, longitude: lng } : undefined } }
        }
      });

      const text = response.text || "[]";
      const jsonMatch = text.match(/\[.*\]/s);
      const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

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
        coordinates: { lat: r.lat || 0, lng: r.lng || 0 }
      }));
    } catch (e) {
      console.error("Erreur Gemini lors de la recherche :", e);
      return [];
    }
  }

  async speakDescription(text: string) {
    const model = this.ai;
    if (!model) return;
    try {
      const response = await model.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Lis ceci de manière chaleureuse : ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const base64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64) this.playRawAudio(base64);
    } catch (e) {
      console.error("Erreur TTS :", e);
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
      console.error("Erreur lecture audio :", e);
    }
  }

  async connectLiveAssistant(callbacks: any) {
    const model = this.ai;
    if (!model) throw new Error("IA indisponible");
    return model.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "Tu es un assistant expert en terrasses. Parle français.",
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
      }
    });
  }
}

export const gemini = new GeminiService();
