// Build-time content generation : intro paragraphs and FAQ for SEO pages.
// Délégué au routeur AI multi-provider (src/lib/ai-router.ts) qui essaie
// successivement Claude → GPT-4o-mini → Gemini selon les keys disponibles.
// Le fichier garde son nom historique gemini.ts pour minimiser le diff sur
// les appelants ; les exports n'ont plus rien de spécifique à Google.

import { generate } from './ai-router';

export interface IntroInput {
  ville: string;
  quartier: string | null;
  lat: number;
  lng: number;
}

export async function generateIntro(input: IntroInput): Promise<string> {
  const target = input.quartier
    ? `le quartier ${input.quartier} à ${input.ville}`
    : `la ville de ${input.ville}`;
  const prompt = `Rédige une introduction de 150 à 200 mots pour une page web intitulée "Terrasses ensoleillées à ${input.quartier ?? input.ville}". Cible : ${target}, coordonnées ${input.lat},${input.lng}. Évoque l'ambiance du quartier, l'orientation typique des rues, les heures de la journée où le soleil est le mieux. Ton chaleureux, factuel, sans superlatifs creux. Pas d'introduction méta ("Voici un texte..."), pas de conclusion qui commence par "En somme". Démarre directement dans le sujet.`;

  const res = await generate({
    system: 'Tu rédiges du contenu éditorial chaleureux et factuel pour un guide de terrasses ensoleillées en France.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 600,
  });
  return res.text;
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
  const target = input.quartier ? `${input.quartier}, ${input.ville}` : input.ville;
  const prompt = `Rédige 4 questions-réponses fréquentes sur les terrasses ensoleillées à ${target}. Questions concrètes qu'un visiteur se poserait (meilleurs créneaux, ouvertures dimanche, bons plans apéro, etc.). Réponses en 1-2 phrases, pratiques.

Réponds EXCLUSIVEMENT avec un tableau JSON au format :
[{"question":"...","answer":"..."}, ...]`;

  const res = await generate({
    system: "Tu réponds toujours par un JSON strict, sans texte hors du JSON.",
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 800,
  });
  const match = res.text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as FaqEntry[]) : [];
  } catch {
    return [];
  }
}
