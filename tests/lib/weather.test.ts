import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchCloudCover, fetchCloudCoverFactor } from '@/lib/weather';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchCloudCover', () => {
  it('returns cloud cover at target UTC hour', async () => {
    const hours = Array.from({ length: 24 }, (_, i) => `2026-06-21T${String(i).padStart(2, '0')}:00`);
    const covers = Array.from({ length: 24 }, (_, i) => i * 4);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hourly: { time: hours, cloudcover: covers } }),
      }),
    );
    const pct = await fetchCloudCover({ lat: 45, lng: 4, date: new Date('2026-06-21T15:00:00Z') });
    expect(pct).toBe(60);
  });

  it('returns null on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const pct = await fetchCloudCover({ lat: 45, lng: 4, date: new Date() });
    expect(pct).toBeNull();
  });

  it('returns null on fetch throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    const pct = await fetchCloudCover({ lat: 45, lng: 4, date: new Date() });
    expect(pct).toBeNull();
  });
});

describe('fetchCloudCoverFactor', () => {
  it('converts percent to 0-1 factor', async () => {
    const hours = Array.from({ length: 24 }, (_, i) => `2026-06-21T${String(i).padStart(2, '0')}:00`);
    const covers = Array.from({ length: 24 }, () => 0);
    covers[12] = 75;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ hourly: { time: hours, cloudcover: covers } }),
      }),
    );
    const f = await fetchCloudCoverFactor({ lat: 45, lng: 4, date: new Date('2026-06-21T12:00:00Z') });
    expect(f).toBe(0.75);
  });
});
