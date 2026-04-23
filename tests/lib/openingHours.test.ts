import { describe, it, expect } from 'vitest';
import { parseOpeningHours, isOpenAt, isOpenNow } from '@/lib/openingHours';

function at(dayIdx: number, h: number, m = 0): Date {
  // Build a date whose getDay() == dayIdx. April 2026 starts on a Wednesday (dayIdx=3).
  // Use April 5 2026 (Sunday=0) as anchor.
  const base = new Date(2026, 3, 5, h, m, 0); // Sunday
  base.setDate(5 + dayIdx);
  base.setHours(h, m, 0, 0);
  return base;
}

describe('parseOpeningHours', () => {
  it('parses 24/7', () => {
    const s = parseOpeningHours('24/7');
    expect(s).not.toBeNull();
    expect(isOpenAt(s!, at(3, 3, 0))).toBe(true);
  });

  it('parses simple Mo-Su range', () => {
    const s = parseOpeningHours('Mo-Su 09:00-22:00');
    expect(s).not.toBeNull();
    expect(isOpenAt(s!, at(1, 10))).toBe(true);
    expect(isOpenAt(s!, at(1, 23))).toBe(false);
    expect(isOpenAt(s!, at(1, 8))).toBe(false);
  });

  it('parses bare range without day (implies every day)', () => {
    const s = parseOpeningHours('10:00-20:00');
    expect(s).not.toBeNull();
    expect(isOpenAt(s!, at(0, 15))).toBe(true);
  });

  it('parses multi-part schedule with Sa off', () => {
    const s = parseOpeningHours('Mo-Fr 08:00-19:00; Sa 09:00-13:00; Su off');
    expect(s).not.toBeNull();
    expect(isOpenAt(s!, at(1, 12))).toBe(true);   // Monday noon
    expect(isOpenAt(s!, at(6, 10))).toBe(true);   // Saturday morning
    expect(isOpenAt(s!, at(6, 15))).toBe(false);  // Saturday afternoon
    expect(isOpenAt(s!, at(0, 12))).toBe(false);  // Sunday
  });

  it('parses comma-separated ranges (lunch + dinner)', () => {
    const s = parseOpeningHours('Mo-Su 12:00-14:00,19:00-22:00');
    expect(s).not.toBeNull();
    expect(isOpenAt(s!, at(3, 13))).toBe(true);
    expect(isOpenAt(s!, at(3, 16))).toBe(false);
    expect(isOpenAt(s!, at(3, 20))).toBe(true);
  });

  it('handles midnight crossing', () => {
    const s = parseOpeningHours('Mo-Su 18:00-02:00');
    expect(s).not.toBeNull();
    expect(isOpenAt(s!, at(3, 23))).toBe(true);
    expect(isOpenAt(s!, at(3, 1))).toBe(true);
    expect(isOpenAt(s!, at(3, 12))).toBe(false);
  });

  it('returns null for complex unsupported patterns', () => {
    expect(parseOpeningHours('Apr-Sep Mo-Su 09:00-22:00')).toBeNull();
    expect(parseOpeningHours('PH off')).toBeNull();
  });
});

describe('isOpenNow', () => {
  it('returns null when input is empty or null', () => {
    expect(isOpenNow(null)).toBeNull();
    expect(isOpenNow('')).toBeNull();
  });

  it('returns null for unparseable strings', () => {
    expect(isOpenNow('whenever we feel like it')).toBeNull();
  });

  it('parses and evaluates 24/7', () => {
    expect(isOpenNow('24/7', new Date())).toBe(true);
  });
});
