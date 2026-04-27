/**
 * AI router for the Astro build pipeline (Node).
 * Mirrors the Deno version on the Edge Functions
 * (terrasses-supabase-stack/supabase/functions/_shared/ai-router.ts).
 *
 * Fallback chain : Claude Sonnet → GPT-4o-mini → Gemini 2.5 Flash.
 * Picks the first provider with a configured key; falls back on transient errors.
 */

export type AIMessage =
  | { role: 'assistant'; content: string }
  | { role: 'user'; content: string };

export type AIRequest = {
  system?: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type ProviderId = 'anthropic' | 'openai' | 'google';

export type AIResponse = {
  text: string;
  provider: ProviderId;
  model: string;
  latencyMs: number;
};

class AIProviderError extends Error {
  constructor(public readonly provider: ProviderId, message: string) {
    super(`[${provider}] ${message}`);
    this.name = 'AIProviderError';
  }
}

type Provider = {
  id: ProviderId;
  model: string;
  isAvailable: boolean;
  call(req: AIRequest): Promise<AIResponse>;
};

const CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';
const OPENAI_MODEL = 'gpt-4o-mini';
const GEMINI_MODEL = 'gemini-2.5-flash';

function anthropic(apiKey: string | undefined): Provider {
  return {
    id: 'anthropic',
    model: CLAUDE_MODEL,
    isAvailable: !!apiKey,
    async call(req) {
      if (!apiKey) throw new AIProviderError('anthropic', 'ANTHROPIC_API_KEY not set');
      const started = Date.now();
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: req.maxTokens ?? 1024,
          temperature: req.temperature,
          system: req.system,
          messages: req.messages,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIProviderError('anthropic', `HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = json.content?.find((c) => c.type === 'text')?.text?.trim();
      if (!text) throw new AIProviderError('anthropic', 'empty response');
      return { text, provider: 'anthropic', model: CLAUDE_MODEL, latencyMs: Date.now() - started };
    },
  };
}

function openai(apiKey: string | undefined): Provider {
  return {
    id: 'openai',
    model: OPENAI_MODEL,
    isAvailable: !!apiKey,
    async call(req) {
      if (!apiKey) throw new AIProviderError('openai', 'OPENAI_API_KEY not set');
      const started = Date.now();
      const messages: unknown[] = [];
      if (req.system) messages.push({ role: 'system', content: req.system });
      for (const m of req.messages) messages.push({ role: m.role, content: m.content });

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          temperature: req.temperature,
          max_tokens: req.maxTokens,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIProviderError('openai', `HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim();
      if (!text) throw new AIProviderError('openai', 'empty response');
      return { text, provider: 'openai', model: OPENAI_MODEL, latencyMs: Date.now() - started };
    },
  };
}

function google(apiKey: string | undefined): Provider {
  return {
    id: 'google',
    model: GEMINI_MODEL,
    isAvailable: !!apiKey,
    async call(req) {
      if (!apiKey) throw new AIProviderError('google', 'GEMINI_BUILD_KEY not set');
      const started = Date.now();
      const contents = req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
          generationConfig: {
            temperature: req.temperature,
            maxOutputTokens: req.maxTokens,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new AIProviderError('google', `HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new AIProviderError('google', 'empty response');
      return { text, provider: 'google', model: GEMINI_MODEL, latencyMs: Date.now() - started };
    },
  };
}

const ORDER: ProviderId[] = ['anthropic', 'openai', 'google'];

export async function generate(req: AIRequest): Promise<AIResponse> {
  const providers: Record<ProviderId, Provider> = {
    anthropic: anthropic(process.env.ANTHROPIC_API_KEY),
    openai: openai(process.env.OPENAI_API_KEY),
    google: google(process.env.GEMINI_BUILD_KEY ?? process.env.GEMINI_API_KEY),
  };

  const errors: string[] = [];
  for (const id of ORDER) {
    const p = providers[id];
    if (!p.isAvailable) continue;
    try {
      return await p.call(req);
    } catch (e) {
      const msg = (e as Error).message;
      console.warn(`[ai-router] ${id} failed: ${msg}`);
      errors.push(`${id}: ${msg}`);
    }
  }

  if (errors.length === 0) {
    throw new Error(
      'No AI provider configured. Set at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_BUILD_KEY.',
    );
  }
  throw new Error(`All AI providers failed. Tried: ${errors.join(' · ')}`);
}

export function hasAnyAIProvider(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_BUILD_KEY ||
      process.env.GEMINI_API_KEY,
  );
}
