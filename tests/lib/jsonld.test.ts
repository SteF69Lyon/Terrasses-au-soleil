import { describe, it, expect } from 'vitest';
import { breadcrumbList, itemList, faqPage, webPage } from '@/lib/jsonld';

describe('breadcrumbList', () => {
  it('builds breadcrumb JSON-LD', () => {
    const ld = breadcrumbList([
      { name: 'Accueil', url: 'https://terrasse-au-soleil.fr/' },
      { name: 'Terrasses', url: 'https://terrasse-au-soleil.fr/terrasses/' },
      { name: 'Lyon', url: 'https://terrasse-au-soleil.fr/terrasses/lyon/' },
    ]) as any;
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toHaveLength(3);
    expect(ld.itemListElement[0]).toMatchObject({
      '@type': 'ListItem',
      position: 1,
      name: 'Accueil',
    });
  });
});

describe('itemList', () => {
  it('builds ItemList of LocalBusiness', () => {
    const ld = itemList([
      { name: 'Le Bar', type: 'bar', address: '1 rue X', lat: 45, lng: 4 },
      { name: 'Café Soleil', type: 'cafe', address: null, lat: 45.1, lng: 4.1 },
    ]) as any;
    expect(ld['@type']).toBe('ItemList');
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0].item['@type']).toBe('BarOrPub');
    expect(ld.itemListElement[1].item['@type']).toBe('CafeOrCoffeeShop');
  });
});

describe('faqPage', () => {
  it('builds FAQPage', () => {
    const ld = faqPage([
      { question: 'Q1 ?', answer: 'R1.' },
      { question: 'Q2 ?', answer: 'R2.' },
    ]) as any;
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q1 ?',
      acceptedAnswer: { '@type': 'Answer', text: 'R1.' },
    });
  });
});

describe('webPage', () => {
  it('builds WebPage with about', () => {
    const ld = webPage({
      name: 'Terrasses Lyon',
      description: 'desc',
      url: 'https://terrasse-au-soleil.fr/terrasses/lyon/',
      aboutPlaceName: 'Lyon',
    }) as any;
    expect(ld['@type']).toBe('WebPage');
    expect(ld.about).toMatchObject({ '@type': 'Place', name: 'Lyon' });
  });
});
