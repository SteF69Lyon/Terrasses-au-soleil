// Build-time content generation : intro paragraphs and FAQ for SEO pages.
// Délégué au routeur AI multi-provider (src/lib/ai-router.ts) qui essaie
// successivement Claude → GPT-4o-mini → Gemini selon les keys disponibles.

import { generate } from './ai-router';
import type { VariationType } from './urls';

export interface IntroInput {
  ville: string;
  quartier: string | null;
  lat: number;
  lng: number;
  /** Optional : si fourni, l'intro est spécialisée pour ce type de page lexical. */
  variation?: VariationType;
}

const VARIATION_ANGLE: Record<VariationType, string> = {
  bar: "des BARS qui ont une terrasse ensoleillée. Insiste sur l'ambiance apéro, les fins de journée, les options pour boire un verre.",
  cafe: "des CAFÉS avec terrasse au soleil. Insiste sur les pauses café et déjeuner, le coffee shop, les bons spots pour bosser ou bruncher dehors.",
  restaurant: "des RESTAURANTS avec terrasse ensoleillée. Insiste sur le déjeuner et le dîner en extérieur, la diversité gastronomique, les bons rapports qualité/lumière.",
  verre: "des spots où BOIRE UN VERRE au soleil (mix bars + cafés). Insiste sur les heures dorées, l'apéro, l'ambiance détendue.",
};

export async function generateIntro(input: IntroInput): Promise<string> {
  const target = input.quartier
    ? `le quartier ${input.quartier} à ${input.ville}`
    : `la ville de ${input.ville}`;

  const angle = input.variation
    ? `Cible spécifique : ${VARIATION_ANGLE[input.variation]} Le texte doit donc parler EXCLUSIVEMENT de ce sous-ensemble, pas de tous les types d'établissements.`
    : "Cible : panorama large couvrant bars, cafés et restaurants avec terrasse.";

  const prompt = `Rédige une introduction de 150 à 200 mots pour une page web SEO. Localité : ${target}, coordonnées ${input.lat},${input.lng}.

${angle}

Évoque l'ambiance, l'orientation typique des rues, les heures de la journée où le soleil est le mieux. Ton chaleureux, factuel, sans superlatifs creux. Pas d'introduction méta ("Voici un texte..."), pas de conclusion qui commence par "En somme". Démarre directement dans le sujet. N'invente pas de noms d'établissements.`;

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
  variation?: VariationType;
}

const VARIATION_FAQ_FOCUS: Record<VariationType, string> = {
  bar: "spécifiquement aux bars (apéro, happy hours, ambiance soir, sortie verre)",
  cafe: "spécifiquement aux cafés (matin, brunch, déjeuner, télétravail, pâtisseries)",
  restaurant: "spécifiquement aux restaurants (déjeuner, dîner, gastronomie, réservation)",
  verre: "à l'expérience de boire un verre dehors (apéro, terrasse à l'heure dorée, ambiance estivale)",
};

export async function generateFaq(input: FaqInput): Promise<FaqEntry[]> {
  const target = input.quartier ? `${input.quartier}, ${input.ville}` : input.ville;
  const focus = input.variation
    ? `Les questions doivent être liées ${VARIATION_FAQ_FOCUS[input.variation]}, pas génériques sur les terrasses.`
    : "Les questions sont génériques sur les terrasses ensoleillées (créneaux, dimanche, bons plans).";

  const prompt = `Rédige 4 questions-réponses fréquentes sur les terrasses ensoleillées à ${target}. ${focus} Questions concrètes qu'un visiteur se poserait. Réponses en 1-2 phrases, pratiques.

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
