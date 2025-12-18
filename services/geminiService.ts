
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EstablishmentType, SunLevel, Terrace, UserProfile } from "../types";

export class GeminiService {
  private get ai(): GoogleGenAI | null {
    // Sur Hostinger, process.env n'existe pas. On vérifie sa présence.
    const apiKey = typeof process !== 'undefined' ? process.env?.API_KEY : (window as any).GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Clé API Gemini manquante. Les fonctions IA seront désactivées.");
      return null;
    }
    return new GoogleGenAI({ apiKey });
  }

  async findTerraces(
    location: string, 
    type: EstablishmentType, 
    date: string, 
    time: string,
    lat?: number, 
    lng?: number
  ): Promise<Terrace[]> {
    if (!this.ai) return [];

    const prompt = `Trouve des terrasses à "${location}" pour le ${date} à ${time}. Type: ${type}.
    Calcule l'ensoleillement en % selon les ombres portées.
    Réponds uniquement un JSON : [{name, address, type, sunExposure, description, rating, lat, lng}]`;

    try {
      const response = await this.ai.models.generateContent({
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
        type: r.type as EstablishmentType,
        sunExposure: r.sunExposure || 0,
        sunLevel: r.sunExposure > 65 ? SunLevel.FULL : r.sunExposure > 25 ? SunLevel.PARTIAL : SunLevel.SHADED,
        description: r.description || "Analyse d'ensoleillement par IA.",
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(r.name)}/400/300`,
        rating: r.rating || 4.0,
        coordinates: { lat: r.lat || 0, lng: r.lng || 0 }
      }));
    } catch (e) {
      console.error("Erreur Gemini :", e);
      return [];
    }
  }

  async speakDescription(text: string) {
    if (!this.ai) return;
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Lis ceci : ${text}` }] }],
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
    if (!this.ai) throw new Error("IA indisponible");
    return this.ai.live.connect({
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
