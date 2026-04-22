export const SITE = 'https://terrasse-au-soleil.fr';

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function villeUrl(villeSlug: string): string {
  return `/terrasses/${villeSlug}/`;
}

export function quartierUrl(villeSlug: string, quartierSlug: string): string {
  return `/terrasses/${villeSlug}/${quartierSlug}/`;
}

export type VariationType = 'bar' | 'cafe' | 'restaurant' | 'verre';

export function variationUrl(type: VariationType, villeSlug: string): string {
  switch (type) {
    case 'bar': return `/bar-ensoleille-${villeSlug}/`;
    case 'cafe': return `/cafe-terrasse-${villeSlug}/`;
    case 'restaurant': return `/restaurant-terrasse-${villeSlug}/`;
    case 'verre': return `/ou-boire-un-verre-au-soleil-${villeSlug}/`;
  }
}

export function absoluteUrl(relative: string): string {
  return `${SITE}${relative}`;
}
