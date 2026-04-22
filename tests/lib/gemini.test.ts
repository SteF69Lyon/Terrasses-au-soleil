import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreSunExposure, generateIntro, generateFaq } from '@/lib/gemini';
import type { Establishment } from '@/lib/overpass';

const mockGenerate = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerate },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_BUILD_KEY = 'test-key';
});

const makeEst = (i: number): Establishment => ({
  osmId: `node/${i}`,
  name: `Bar ${i}`,
  type: 'bar',
  lat: 45,
  lng: 4,
  address: 'rue X',
  website: null,
  outdoorSeating: true,
});

describe('scoreSunExposure', () => {
  it('returns scores from Gemini JSON response', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        { osmId: 'node/1', sunPercent: 80, orientation: 'S', analysis: 'Ensoleillée toute l\'après-midi.' },
        { osmId: 'node/2', sunPercent: 30, orientation: 'N', analysis: 'Ombragée.' },
      ]),
    });
    const res = await scoreSunExposure([makeEst(1), makeEst(2)]);
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({ osmId: 'node/1', sunPercent: 80 });
    expect(res[1]).toMatchObject({ osmId: 'node/2', sunPercent: 30 });
  });
});

describe('generateIntro', () => {
  it('returns intro text', async () => {
    mockGenerate.mockResolvedValue({ text: 'Croix-Rousse est un quartier perché où les rues orientées est-ouest captent le soleil du matin au soir...' });
    const intro = await generateIntro({
      ville: 'Lyon',
      quartier: 'Croix-Rousse',
      lat: 45.77,
      lng: 4.83,
    });
    expect(intro).toContain('Croix-Rousse');
    expect(intro.length).toBeGreaterThan(50);
  });
});

describe('generateFaq', () => {
  it('returns array of Q/A', async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        { question: 'Où aller le dimanche ?', answer: 'Essayez...' },
      ]),
    });
    const faq = await generateFaq({ ville: 'Lyon', quartier: 'Croix-Rousse' });
    expect(faq).toHaveLength(1);
    expect(faq[0]).toMatchObject({ question: 'Où aller le dimanche ?' });
  });
});
