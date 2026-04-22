export interface BreadcrumbItem { name: string; url: string }

export function breadcrumbList(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export interface ListEstablishment {
  name: string;
  type: 'bar' | 'cafe' | 'restaurant';
  address: string | null;
  lat: number;
  lng: number;
}

const TYPE_MAP = {
  bar: 'BarOrPub',
  cafe: 'CafeOrCoffeeShop',
  restaurant: 'Restaurant',
} as const;

export function itemList(items: ListEstablishment[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': TYPE_MAP[e.type],
        name: e.name,
        ...(e.address ? { address: e.address } : {}),
        geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lng },
      },
    })),
  };
}

export interface FaqPair { question: string; answer: string }

export function faqPage(pairs: FaqPair[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map((p) => ({
      '@type': 'Question',
      name: p.question,
      acceptedAnswer: { '@type': 'Answer', text: p.answer },
    })),
  };
}

export interface WebPageInput {
  name: string;
  description: string;
  url: string;
  aboutPlaceName?: string;
}

export function webPage(input: WebPageInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.aboutPlaceName ? { about: { '@type': 'Place', name: input.aboutPlaceName } } : {}),
  };
}
