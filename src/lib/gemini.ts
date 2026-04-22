import { GoogleGenAI } from '@google/genai';
import type { Establishment } from './overpass';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_BUILD_KEY;
  if (!apiKey) throw new Error('GEMINI_BUILD_KEY env var missing at build time.');
  return new GoogleGenAI({ apiKey });
}

export interface SunScore {
  osmId: string;
  sunPercent: number;
  orientation: string;
  analysis: string;
}

export async function scoreSunExposure(batch: Establishment[]): Promise<SunScore[]> {
  if (batch.length === 0) return [];
  const ai = getClient();
  const list = batch
    .map((e) => `- osmId: ${e.osmId}, nom: ${e.name}, adresse: ${e.address ?? 'inconnue'}, coord: ${e.lat},${e.lng}`)
    .join('\n');
  const prompt = `Pour chacun des établissements ci-dessous, estime le pourcentage d'ensoleillement de la terrasse à 17h un jour d'été (mai à août), l'orientation probable, et une analyse en 1-2 phrases. Base-toi sur l'orientation probable de la rue et l'exposition solaire à cette heure à cette latitude.

${list}

Réponds EXCLUSIVEMENT avec un tableau JSON, un objet par établissement, dans le même ordre, au format :
[{"osmId":"...","sunPercent":80,"orientation":"S","analysis":"..."}, ...]`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  const text = response.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  return match ? (JSON.parse(match[0]) as SunScore[]) : [];
}

export interface IntroInput {
  ville: string;
  quartier: string | null;
  lat: number;
  lng: number;
}

export async function generateIntro(input: IntroInput): Promise<string> {
  const ai = getClient();
  const target = input.quartier ? `le quartier ${input.quartier} à ${input.ville}` : `la ville de ${input.ville}`;
  const prompt = `Rédige une introduction de 150 à 200 mots pour une page web intitulée "Terrasses ensoleillées à ${input.quartier ?? input.ville}". Cible : ${target}, coordonnées ${input.lat},${input.lng}. Évoque l'ambiance du quartier, l'orientation typique des rues, les heures de la journée où le soleil est le mieux. Ton chaleureux, factuel, sans superlatifs creux. Pas d'introduction méta ("Voici un texte..."), pas de conclusion qui commence par "En somme". Démarre directement dans le sujet.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  return (response.text ?? '').trim();
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface FaqInput {
  ville: string;
  quartier: string | null;
}

export async function generateFaq(input: FaqInput): Promise<FaqEntry[]> {
  const ai = getClient();
  const target = input.quartier ? `${input.quartier}, ${input.ville}` : input.ville;
  const prompt = `Rédige 4 questions-réponses fréquentes sur les terrasses ensoleillées à ${target}. Questions concrètes qu'un visiteur se poserait (meilleurs créneaux, ouvertures dimanche, bons plans apéro, etc.). Réponses en 1-2 phrases, pratiques.

Réponds EXCLUSIVEMENT avec un tableau JSON au format :
[{"question":"...","answer":"..."}, ...]`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });
  const text = response.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  return match ? (JSON.parse(match[0]) as FaqEntry[]) : [];
}
