import { GoogleGenAI, Modality } from "@google/genai";
import { EstablishmentType, SunLevel, Terrace } from "../types";

export class GeminiService {
  private createAI() {
    // Détection simplifiée pour Hostinger et environnements statiques
    const apiKey = 
      (window as any).API_KEY || 
      (process.env.API_KEY) || 
      (window as any).process?.env?.API_KEY || 
      (import.meta as any).env?.VITE_API_KEY;
    
    if (!apiKey) {
      console.error("GeminiService: API_KEY introuvable.");
      throw new Error("API_KEY_MISSING");
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
    const ai = this.createAI();

    // Prompt optimisé pour la recherche web
    const prompt = `Recherche des terrasses à "${location}" pour le ${date} vers ${time}. 
    Type d'établissement: ${type}.
    Analyse l'ensoleillement (pourcentage de 0 à 100%) selon l'orientation de la rue et l'heure.
    Réponds EXCLUSIVEMENT sous forme de tableau JSON: 
    [{"name": "Nom", "address": "Adresse complète", "type": "bar|restaurant|cafe", "sunExposure": 80, "description": "Analyse du soleil", "rating": 4.5, "lat": 48.8, "lng": 2.3}]`;

    try {
      // Utilisation de gemini-3-flash-preview (modèle de base recommandé)
      // On utilise UNIQUEMENT googleSearch pour éviter l'erreur 400 de Maps
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || "[]";
      // Extraction sécurisée du JSON dans la réponse (parfois entouré de texte/markdown)
      const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
      const results = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      // Extraction des sources (URLs) de la recherche Google
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks.map((chunk: any) => {
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
      throw e;
    }
  }

  async speakDescription(text: string) {
    try {
      const ai = this.createAI();
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