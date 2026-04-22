import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocode, type BBox } from '@/lib/nominatim';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('nominatim.geocode', () => {
  it('returns bbox from first result', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          boundingbox: ['45.76', '45.78', '4.82', '4.85'],
          display_name: 'Croix-Rousse, Lyon',
        },
      ],
    });
    vi.stubGlobal('fetch', mockFetch);

    const bbox = await geocode('Croix-Rousse, Lyon');
    expect(bbox).toEqual<BBox>({ south: 45.76, north: 45.78, west: 4.82, east: 4.85 });
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('nominatim.openstreetmap.org');
    expect(url).toContain(encodeURIComponent('Croix-Rousse, Lyon'));
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(geocode('x')).rejects.toThrow(/Nominatim HTTP 503/);
  });

  it('throws when no result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    await expect(geocode('nowhere')).rejects.toThrow(/No Nominatim result/);
  });
});
