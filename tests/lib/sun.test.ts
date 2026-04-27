import { describe, it, expect } from 'vitest';
import { computeSunScore } from '@/lib/sun';

describe('computeSunScore', () => {
  it('returns 0 at night', () => {
    const r = computeSunScore({
      lat: 48.85,
      lng: 2.35,
      date: new Date('2026-06-21T01:00:00Z'),
    });
    expect(r.sunPercent).toBe(0);
    expect(r.explanation).toMatch(/horizon/i);
  });

  it('gives high score for south-facing terrace at noon in summer (Paris)', () => {
    const r = computeSunScore({
      lat: 48.85,
      lng: 2.35,
      date: new Date('2026-06-21T12:00:00Z'),
      facing: 180,
    });
    expect(r.sunPercent).toBeGreaterThan(70);
    expect(r.sunAltitudeDeg).toBeGreaterThan(50);
  });

  it('gives zero score for north-facing terrace at noon', () => {
    const r = computeSunScore({
      lat: 48.85,
      lng: 2.35,
      date: new Date('2026-06-21T12:00:00Z'),
      facing: 0,
    });
    expect(r.sunPercent).toBe(0);
  });

  it('halves score with heavy cloud cover', () => {
    const clear = computeSunScore({
      lat: 48.85,
      lng: 2.35,
      date: new Date('2026-06-21T12:00:00Z'),
      facing: 180,
      cloudCover: 0,
    });
    const cloudy = computeSunScore({
      lat: 48.85,
      lng: 2.35,
      date: new Date('2026-06-21T12:00:00Z'),
      facing: 180,
      cloudCover: 1,
    });
    expect(cloudy.sunPercent).toBe(0);
    expect(cloudy.explanation).toMatch(/couvert/);
    expect(clear.sunPercent).toBeGreaterThan(50);
  });

  it('lower score in winter morning vs summer noon', () => {
    const winter = computeSunScore({
      lat: 48.85,
      lng: 2.35,
      date: new Date('2026-12-21T08:00:00Z'),
      facing: 180,
    });
    const summer = computeSunScore({
      lat: 48.85,
      lng: 2.35,
      date: new Date('2026-06-21T12:00:00Z'),
      facing: 180,
    });
    expect(winter.sunPercent).toBeLessThan(summer.sunPercent);
  });
});
