import { describe, it, expect } from 'vitest';
import { slugify, villeUrl, quartierUrl, variationUrl, absoluteUrl } from '@/lib/urls';

describe('slugify', () => {
  it('normalizes accents and spaces', () => {
    expect(slugify('Vieux-Lyon')).toBe('vieux-lyon');
    expect(slugify('11e arrondissement')).toBe('11e-arrondissement');
    expect(slugify('Saint-Michel')).toBe('saint-michel');
    expect(slugify('Aix-en-Provence')).toBe('aix-en-provence');
    expect(slugify('Côte d\'Azur')).toBe('cote-d-azur');
  });

  it('strips non-alphanumeric', () => {
    expect(slugify('Bar & Café !!')).toBe('bar-cafe');
  });
});

describe('url builders', () => {
  it('builds ville URL', () => {
    expect(villeUrl('lyon')).toBe('/terrasses/lyon/');
  });
  it('builds quartier URL', () => {
    expect(quartierUrl('lyon', 'vieux-lyon')).toBe('/terrasses/lyon/vieux-lyon/');
  });
  it('builds variation URL', () => {
    expect(variationUrl('bar', 'lyon')).toBe('/bar-ensoleille-lyon/');
    expect(variationUrl('cafe', 'paris')).toBe('/cafe-terrasse-paris/');
    expect(variationUrl('restaurant', 'marseille')).toBe('/restaurant-terrasse-marseille/');
    expect(variationUrl('verre', 'bordeaux')).toBe('/ou-boire-un-verre-au-soleil-bordeaux/');
  });
  it('builds absolute URL with site', () => {
    expect(absoluteUrl('/terrasses/lyon/')).toBe('https://terrasse-au-soleil.fr/terrasses/lyon/');
  });
});
