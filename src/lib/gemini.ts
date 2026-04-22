import { GoogleGenAI } from '@google/genai';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_BUILD_KEY;
  if (!apiKey) throw new Error('GEMINI_BUILD_KEY env var missing at build time.');
  return new GoogleGenAI({ apiKey });
}

// NOTE: sun scoring has moved to src/lib/sun.ts (deterministic, no Gemini call).
// Gemini is only used here for narrative content (intros and FAQs).

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
    model: 'gemini-2.5-flash',
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
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const text = response.text ?? '[]';
  const match = text.match(/\[[\s\S]*\]/);
  return match ? (JSON.parse(match[0]) as FaqEntry[]) : [];
}
