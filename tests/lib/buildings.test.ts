import { describe, it, expect } from 'vitest';
import { longestEdgeBearing, inferFacing, isShadowed, type Building } from '@/lib/buildings';

describe('longestEdgeBearing', () => {
  it('detects east-west building as bearing ~90', () => {
    const poly: [number, number][] = [
      [2.3, 48.85],
      [2.3010, 48.85],
      [2.3010, 48.8502],
      [2.3, 48.8502],
      [2.3, 48.85],
    ];
    const b = longestEdgeBearing(poly);
    expect(b).toBeGreaterThan(85);
    expect(b).toBeLessThan(95);
  });

  it('detects north-south building as bearing ~0', () => {
    const poly: [number, number][] = [
      [2.3, 48.85],
      [2.3002, 48.85],
      [2.3002, 48.851],
      [2.3, 48.851],
      [2.3, 48.85],
    ];
    const b = longestEdgeBearing(poly);
    expect(b).toBeLessThan(10);
  });
});

describe('inferFacing', () => {
  it('returns null when no buildings within range', () => {
    const facing = inferFacing([2.3, 48.85], []);
    expect(facing).toBeNull();
  });

  it('returns a direction when a nearby east-west building is north of the point', () => {
    const building: Building = {
      osmId: 'way/1',
      polygon: [
        [2.3, 48.8505],
        [2.301, 48.8505],
        [2.301, 48.8506],
        [2.3, 48.8506],
        [2.3, 48.8505],
      ],
      height: 15,
    };
    const facing = inferFacing([2.3005, 48.85], [building]);
    expect(facing).not.toBeNull();
    if (facing != null) {
      expect(facing).toBeGreaterThan(90);
      expect(facing).toBeLessThan(270);
    }
  });
});

describe('isShadowed', () => {
  const bigBuilding: Building = {
    osmId: 'way/1',
    polygon: [
      [2.300, 48.851],
      [2.301, 48.851],
      [2.301, 48.8515],
      [2.300, 48.8515],
      [2.300, 48.851],
    ],
    height: 50,
  };

  it('returns false when sun is below horizon', () => {
    const shadow = isShadowed([2.3005, 48.8505], [bigBuilding], 180, -10);
    expect(shadow).toBe(false);
  });

  it('detects shadow when sun is low in north (for building north of point)', () => {
    const shadow = isShadowed([2.3005, 48.8505], [bigBuilding], 0, 15);
    expect(shadow).toBe(true);
  });

  it('no shadow when sun is south (far from building)', () => {
    const shadow = isShadowed([2.3005, 48.8505], [bigBuilding], 180, 60);
    expect(shadow).toBe(false);
  });
});
