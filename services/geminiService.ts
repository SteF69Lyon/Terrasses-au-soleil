
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { EstablishmentType, SunLevel, Terrace, UserProfile } from "../types";

export class GeminiService {
  /**
   * Obtient une instance fraîche de GoogleGenAI.
   */
  private get ai(): GoogleGenAI {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Clé API manquante. Veuillez configurer process.env.API_KEY.");
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Recherche des terrasses avec grounding Google Maps et Search.
   */
  async findTerraces(
    location: string, 
    type: EstablishmentType, 
    date: string, 
    time: string,
    lat?: number, 
    lng?: number
  ): Promise<Terrace[]> {
    
    const prompt = `Tu es un expert en géométrie urbaine. 
    Localisation: "${location}"
    Type: "${type}"
    Date: ${date}
    Heure: ${time}

    INSTRUCTIONS:
    1. Vérifie la météo réelle à "${location}" pour le ${date} via Google Search.
    2. Trouve des établissements avec terrasse via Google Maps.
    3. Calcule l'exposition au soleil (%) à ${time} selon l'ombre des bâtiments environnants.
    
    Renvoie UNIQUEMENT un tableau JSON:
    [
      {
        "name": "Nom",
        "address": "Adresse",
        "type": "bar|restaurant|cafe|hôtel",
        "sunExposure": 85,
        "description": "Pourquoi est-ce ensoleillé ?",
        "rating": 4.5,
        "lat": 0.0,
        "lng": 0.0
      }
    ]`;

    try {
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
      
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      } else {
        return [];
      }
      
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources = chunks.map(c => {
        if (c.maps) return { title: c.maps.title || "Google Maps", uri: c.maps.uri || "" };
        if (c.web) return { title: c.web.title || "Lien Web", uri: c.web.uri || "" };
        return null;
      }).filter((s): s is { title: string; uri: string } => s !== null && s.uri !== "");

      return results.map((r: any, index: number) => ({
        id: `${index}-${Date.now()}`,
        name: r.name,
        address: r.address,
        type: (r.type || type) as EstablishmentType,
        sunExposure: r.sunExposure || 0,
        sunLevel: r.sunExposure > 65 ? SunLevel.FULL : r.sunExposure > 25 ? SunLevel.PARTIAL : SunLevel.SHADED,
        description: r.description || "Analyse basée sur les ombres portées théoriques.",
        imageUrl: `https://picsum.photos/seed/${encodeURIComponent(r.name)}/400/300`,
        rating: r.rating || 4.0,
        coordinates: { lat: r.lat || 0, lng: r.lng || 0 },
        sources: sources
      }));
    } catch (e) {
      console.error("Gemini Search Error:", e);
      return [];
    }
  }

  async generateForecastEmail(profile: UserProfile, favorites: Terrace[]): Promise<string> {
    const prompt = `Génère un email pour ${profile.name} sur les prévisions soleil de ses favoris :
    ${favorites.map(f => `- ${f.name}`).join('\n')}`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "";
  }

  async speakDescription(text: string) {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Lis ceci : ${text}` }] }],
        config: {
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
    } catch (e) {
      console.error("TTS Error:", e);
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
        responseModalities: [Modality.AUDIO],
        systemInstruction: "Tu es un assistant expert en terrasses. Parle français.",
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        }
      }
    });
  }
}

export const gemini = new GeminiService();
