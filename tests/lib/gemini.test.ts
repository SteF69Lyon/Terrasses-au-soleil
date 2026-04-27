import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateIntro, generateFaq } from '@/lib/gemini';

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
