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
      { slug: 'montmartre', name: 'Montmartre', searchHint: 'Montmartre, Paris' },
      { slug: 'canal-saint-martin', name: 'Canal Saint-Martin', searchHint: 'Canal Saint-Martin, Paris' },
      { slug: 'batignolles', name: 'Batignolles', searchHint: 'Batignolles, Paris' },
      { slug: 'saint-germain', name: 'Saint-Germain-des-Prés', searchHint: 'Saint-Germain-des-Prés, Paris' },
      { slug: 'quartier-latin', name: 'Quartier Latin', searchHint: 'Quartier Latin, Paris' },
      { slug: 'bastille', name: 'Bastille', searchHint: 'Bastille, Paris' },
      { slug: 'republique', name: 'République', searchHint: 'République, Paris' },
      { slug: 'pigalle', name: 'Pigalle', searchHint: 'Pigalle, Paris' },
      { slug: 'butte-aux-cailles', name: 'Butte-aux-Cailles', searchHint: 'Butte-aux-Cailles, Paris' },
      { slug: '1er', name: '1er arrondissement', searchHint: '1er arrondissement, Paris' },
      { slug: '11e', name: '11e arrondissement', searchHint: '11e arrondissement, Paris' },
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
      { slug: 'presquile', name: 'Presqu\'île', searchHint: 'Presqu\'île, Lyon' },
      { slug: 'bellecour', name: 'Bellecour', searchHint: 'Place Bellecour, Lyon' },
      { slug: 'ainay', name: 'Ainay', searchHint: 'Ainay, Lyon 2e' },
      { slug: 'brotteaux', name: 'Brotteaux', searchHint: 'Brotteaux, Lyon' },
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
      { slug: 'prado', name: 'Prado', searchHint: 'Avenue du Prado, Marseille' },
      { slug: 'notre-dame-du-mont', name: 'Notre-Dame-du-Mont', searchHint: 'Notre-Dame-du-Mont, Marseille' },
      { slug: 'endoume', name: 'Endoume', searchHint: 'Endoume, Marseille' },
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
      { slug: 'bassins-a-flot', name: 'Bassins à Flot', searchHint: 'Bassins à flot, Bordeaux' },
      { slug: 'victoire', name: 'La Victoire', searchHint: 'Place de la Victoire, Bordeaux' },
      { slug: 'bacalan', name: 'Bacalan', searchHint: 'Bacalan, Bordeaux' },
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
      { slug: 'saint-aubin', name: 'Saint-Aubin', searchHint: 'Saint-Aubin, Toulouse' },
      { slug: 'minimes', name: 'Minimes', searchHint: 'Minimes, Toulouse' },
    ],
  },
  {
    slug: 'nice',
    name: 'Nice',
    region: 'Provence-Alpes-Côte d\'Azur',
    quartiers: [
      { slug: 'vieux-nice', name: 'Vieux-Nice', searchHint: 'Vieux Nice, Nice' },
      { slug: 'promenade-des-anglais', name: 'Promenade des Anglais', searchHint: 'Promenade des Anglais, Nice' },
      { slug: 'port', name: 'Port', searchHint: 'Port de Nice' },
      { slug: 'libération', name: 'Libération', searchHint: 'Libération, Nice' },
    ],
  },
  {
    slug: 'nantes',
    name: 'Nantes',
    region: 'Pays de la Loire',
    quartiers: [
      { slug: 'bouffay', name: 'Bouffay', searchHint: 'Bouffay, Nantes' },
      { slug: 'graslin', name: 'Graslin', searchHint: 'Graslin, Nantes' },
      { slug: 'ile-de-nantes', name: 'Île de Nantes', searchHint: 'Île de Nantes' },
      { slug: 'hauts-paves', name: 'Hauts-Pavés', searchHint: 'Hauts-Pavés, Nantes' },
    ],
  },
  {
    slug: 'strasbourg',
    name: 'Strasbourg',
    region: 'Grand Est',
    quartiers: [
      { slug: 'petite-france', name: 'Petite France', searchHint: 'Petite France, Strasbourg' },
      { slug: 'krutenau', name: 'Krutenau', searchHint: 'Krutenau, Strasbourg' },
      { slug: 'neudorf', name: 'Neudorf', searchHint: 'Neudorf, Strasbourg' },
    ],
  },
  {
    slug: 'lille',
    name: 'Lille',
    region: 'Hauts-de-France',
    quartiers: [
      { slug: 'vieux-lille', name: 'Vieux-Lille', searchHint: 'Vieux-Lille, Lille' },
      { slug: 'wazemmes', name: 'Wazemmes', searchHint: 'Wazemmes, Lille' },
      { slug: 'euralille', name: 'Euralille', searchHint: 'Euralille, Lille' },
    ],
  },
  {
    slug: 'montpellier',
    name: 'Montpellier',
    region: 'Occitanie',
    quartiers: [
      { slug: 'ecusson', name: 'Écusson', searchHint: 'Écusson, Montpellier' },
      { slug: 'antigone', name: 'Antigone', searchHint: 'Antigone, Montpellier' },
      { slug: 'comedie', name: 'Comédie', searchHint: 'Place de la Comédie, Montpellier' },
    ],
  },
  {
    slug: 'rennes',
    name: 'Rennes',
    region: 'Bretagne',
    quartiers: [
      { slug: 'centre', name: 'Centre', searchHint: 'Centre-ville, Rennes' },
      { slug: 'thabor', name: 'Thabor', searchHint: 'Thabor, Rennes' },
      { slug: 'saint-helier', name: 'Saint-Hélier', searchHint: 'Saint-Hélier, Rennes' },
    ],
  },
  {
    slug: 'annecy',
    name: 'Annecy',
    region: 'Auvergne-Rhône-Alpes',
    quartiers: [
      { slug: 'vieille-ville', name: 'Vieille Ville', searchHint: 'Vieille ville, Annecy' },
      { slug: 'paquier', name: 'Pâquier', searchHint: 'Le Pâquier, Annecy' },
    ],
  },
  {
    slug: 'aix-en-provence',
    name: 'Aix-en-Provence',
    region: 'Provence-Alpes-Côte d\'Azur',
    quartiers: [
      { slug: 'cours-mirabeau', name: 'Cours Mirabeau', searchHint: 'Cours Mirabeau, Aix-en-Provence' },
      { slug: 'mazarin', name: 'Mazarin', searchHint: 'Mazarin, Aix-en-Provence' },
    ],
  },
  { slug: 'biarritz', name: 'Biarritz', region: 'Nouvelle-Aquitaine', quartiers: [] },
  { slug: 'la-rochelle', name: 'La Rochelle', region: 'Nouvelle-Aquitaine', quartiers: [] },
  { slug: 'grenoble', name: 'Grenoble', region: 'Auvergne-Rhône-Alpes', quartiers: [] },
  { slug: 'clermont-ferrand', name: 'Clermont-Ferrand', region: 'Auvergne-Rhône-Alpes', quartiers: [] },
  { slug: 'dijon', name: 'Dijon', region: 'Bourgogne-Franche-Comté', quartiers: [] },
  { slug: 'tours', name: 'Tours', region: 'Centre-Val de Loire', quartiers: [] },
  { slug: 'angers', name: 'Angers', region: 'Pays de la Loire', quartiers: [] },
  { slug: 'reims', name: 'Reims', region: 'Grand Est', quartiers: [] },
  { slug: 'le-havre', name: 'Le Havre', region: 'Normandie', quartiers: [] },
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
