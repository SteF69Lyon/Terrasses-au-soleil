import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCached, setCached, type CacheEntry } from '@/lib/cache';

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn(() => ({ get: mockGet, set: mockSet }));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockDb = { collection: mockCollection } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cache', () => {
  it('returns cached data when fresh', async () => {
    const now = Date.now();
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ data: { foo: 'bar' }, fetchedAt: now }),
    });
    const res = await getCached(mockDb, 'osmCache', 'lyon-vieux', 1000 * 60 * 60);
    expect(res).toEqual({ foo: 'bar' });
  });

  it('returns null when stale', async () => {
    const stale = Date.now() - 1000 * 60 * 60 * 24 * 100;
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ data: { foo: 'bar' }, fetchedAt: stale }),
    });
    const res = await getCached(mockDb, 'osmCache', 'lyon-vieux', 1000 * 60 * 60);
    expect(res).toBeNull();
  });

  it('returns null when missing', async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await getCached(mockDb, 'osmCache', 'lyon-vieux', 1000);
    expect(res).toBeNull();
  });

  it('writes with fetchedAt timestamp', async () => {
    await setCached(mockDb, 'osmCache', 'lyon-vieux', { foo: 'bar' });
    expect(mockSet).toHaveBeenCalledTimes(1);
    const arg = mockSet.mock.calls[0][0] as CacheEntry<any>;
    expect(arg.data).toEqual({ foo: 'bar' });
    expect(typeof arg.fetchedAt).toBe('number');
    expect(arg.fetchedAt).toBeLessThanOrEqual(Date.now());
  });
});
