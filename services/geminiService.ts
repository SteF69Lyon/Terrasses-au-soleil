import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { GoogleGenAI, Modality } from '@google/genai';
import { EstablishmentType, SunLevel, Terrace } from '../types';

const REGION = 'europe-west1';

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

  async connectLiveAssistant(callbacks: any) {
    const tokenFn = httpsCallable(this.fns(), 'geminiLiveToken');
    const result = await tokenFn({});
    const { apiKey } = result.data as { apiKey: string };

    const ai = new GoogleGenAI({ apiKey });
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction:
          "Tu es un expert en terrasses. Aide l'utilisateur à trouver le soleil. Réponds en français.",
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
      },
    });
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
