import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEstablishments, type Establishment } from '@/lib/overpass';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('overpass.fetchEstablishments', () => {
  it('parses nodes and ways into Establishment[]', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 1,
            lat: 45.77,
            lon: 4.83,
            tags: { name: 'Le Petit Bar', amenity: 'bar', 'addr:street': 'rue X', 'outdoor_seating': 'yes' },
          },
          {
            type: 'way',
            id: 2,
            center: { lat: 45.771, lon: 4.831 },
            tags: { name: 'Café Soleil', amenity: 'cafe', 'outdoor_seating': 'yes' },
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const list = await fetchEstablishments({ south: 45, north: 46, west: 4, east: 5 });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject<Partial<Establishment>>({
      osmId: 'node/1',
      name: 'Le Petit Bar',
      type: 'bar',
      lat: 45.77,
      lng: 4.83,
    });
    expect(list[1].osmId).toBe('way/2');
    expect(list[1].type).toBe('cafe');
  });

  it('extracts wikimedia image URL when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 99,
            lat: 45,
            lon: 4,
            tags: {
              name: 'Café des Arts',
              amenity: 'cafe',
              wikimedia_commons: 'File:Cafe des Arts Lyon.jpg',
            },
          },
        ],
      }),
    }));
    const list = await fetchEstablishments({ south: 0, north: 1, west: 0, east: 1 });
    expect(list).toHaveLength(1);
    expect(list[0].imageUrl).toContain('Special:FilePath');
    expect(list[0].imageUrl).toContain('Cafe');
  });

  it('uses direct image tag when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          {
            type: 'node',
            id: 100,
            lat: 45,
            lon: 4,
            tags: { name: 'X', amenity: 'bar', image: 'https://example.com/x.jpg' },
          },
        ],
      }),
    }));
    const list = await fetchEstablishments({ south: 0, north: 1, west: 0, east: 1 });
    expect(list[0].imageUrl).toBe('https://example.com/x.jpg');
  });

  it('skips elements without name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        elements: [
          { type: 'node', id: 3, lat: 1, lon: 2, tags: { amenity: 'bar' } },
        ],
      }),
    }));
    const list = await fetchEstablishments({ south: 0, north: 1, west: 0, east: 1 });
    expect(list).toHaveLength(0);
  });
});
