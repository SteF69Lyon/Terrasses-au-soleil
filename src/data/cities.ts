export interface Quartier {
  slug: string;
  name: string;
  searchHint: string;
}

export interface City {
  slug: string;
  name: string;
  region: string;
  quartiers: Quartier[];
}

export const CITIES: City[] = [
  {
    slug: 'paris',
    name: 'Paris',
    region: 'Île-de-France',
    quartiers: [
      { slug: 'marais', name: 'Marais', searchHint: 'Le Marais, Paris' },
      { slug: '11e', name: '11e arrondissement', searchHint: '11e arrondissement, Paris' },
      { slug: 'montmartre', name: 'Montmartre', searchHint: 'Montmartre, Paris' },
      { slug: 'canal-saint-martin', name: 'Canal Saint-Martin', searchHint: 'Canal Saint-Martin, Paris' },
      { slug: 'batignolles', name: 'Batignolles', searchHint: 'Batignolles, Paris' },
    ],
  },
  {
    slug: 'lyon',
    name: 'Lyon',
    region: 'Auvergne-Rhône-Alpes',
    quartiers: [
      { slug: 'vieux-lyon', name: 'Vieux-Lyon', searchHint: 'Vieux Lyon, Lyon' },
      { slug: 'croix-rousse', name: 'Croix-Rousse', searchHint: 'Croix-Rousse, Lyon' },
      { slug: 'confluence', name: 'Confluence', searchHint: 'Lyon Confluence' },
      { slug: 'part-dieu', name: 'Part-Dieu', searchHint: 'Part-Dieu, Lyon' },
    ],
  },
  {
    slug: 'marseille',
    name: 'Marseille',
    region: 'Provence-Alpes-Côte d\'Azur',
    quartiers: [
      { slug: 'vieux-port', name: 'Vieux-Port', searchHint: 'Vieux-Port, Marseille' },
      { slug: 'panier', name: 'Le Panier', searchHint: 'Le Panier, Marseille' },
      { slug: 'cours-julien', name: 'Cours Julien', searchHint: 'Cours Julien, Marseille' },
      { slug: 'joliette', name: 'Joliette', searchHint: 'Joliette, Marseille' },
    ],
  },
  {
    slug: 'bordeaux',
    name: 'Bordeaux',
    region: 'Nouvelle-Aquitaine',
    quartiers: [
      { slug: 'chartrons', name: 'Chartrons', searchHint: 'Chartrons, Bordeaux' },
      { slug: 'saint-michel', name: 'Saint-Michel', searchHint: 'Saint-Michel, Bordeaux' },
      { slug: 'saint-pierre', name: 'Saint-Pierre', searchHint: 'Saint-Pierre, Bordeaux' },
    ],
  },
  {
    slug: 'toulouse',
    name: 'Toulouse',
    region: 'Occitanie',
    quartiers: [
      { slug: 'capitole', name: 'Capitole', searchHint: 'Capitole, Toulouse' },
      { slug: 'carmes', name: 'Carmes', searchHint: 'Carmes, Toulouse' },
      { slug: 'saint-cyprien', name: 'Saint-Cyprien', searchHint: 'Saint-Cyprien, Toulouse' },
    ],
  },
  { slug: 'nice', name: 'Nice', region: 'Provence-Alpes-Côte d\'Azur', quartiers: [] },
  { slug: 'nantes', name: 'Nantes', region: 'Pays de la Loire', quartiers: [] },
  { slug: 'strasbourg', name: 'Strasbourg', region: 'Grand Est', quartiers: [] },
  { slug: 'lille', name: 'Lille', region: 'Hauts-de-France', quartiers: [] },
  { slug: 'montpellier', name: 'Montpellier', region: 'Occitanie', quartiers: [] },
  { slug: 'rennes', name: 'Rennes', region: 'Bretagne', quartiers: [] },
  { slug: 'annecy', name: 'Annecy', region: 'Auvergne-Rhône-Alpes', quartiers: [] },
  { slug: 'aix-en-provence', name: 'Aix-en-Provence', region: 'Provence-Alpes-Côte d\'Azur', quartiers: [] },
  { slug: 'biarritz', name: 'Biarritz', region: 'Nouvelle-Aquitaine', quartiers: [] },
  { slug: 'la-rochelle', name: 'La Rochelle', region: 'Nouvelle-Aquitaine', quartiers: [] },
];

export function findCity(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

export function findQuartier(citySlug: string, quartierSlug: string): Quartier | undefined {
  return findCity(citySlug)?.quartiers.find((q) => q.slug === quartierSlug);
}

export function allCities(): City[] {
  return CITIES;
}
