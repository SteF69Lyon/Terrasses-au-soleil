/**
 * AI router for the Astro build pipeline (Node).
 * Mirrors the Deno version on the Edge Functions
 * (terrasses-supabase-stack/supabase/functions/_shared/ai-router.ts).
 *
 * Fallback chain : Claude Sonnet → GPT-4o-mini → Gemini 2.5 Flash.
 * Picks the first provider with a configured key; falls back on transient errors.
 *
 * Resilience features:
 * - Concurrency cap (CONCURRENCY) so we never hammer providers from
 *   Astro's parallel page renders.
 * - 429-aware retry with backoff (respects Retry-After / retry-after-ms
 *   headers when present, otherwise exponential).
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
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
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

// Cap concurrent in-flight AI calls. With Astro rendering pages in parallel,
// a fresh build of ~50 cities × 4 variations would otherwise launch 200+
// concurrent calls and instantly bust Anthropic's tokens-per-minute quota.
const CONCURRENCY = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(headers: Headers): number | undefined {
  // Anthropic returns retry-after-ms (numeric, ms). Standard HTTP uses
  // Retry-After (seconds, may be HTTP-date). Honour whichever is present.
  const ms = headers.get('retry-after-ms');
  if (ms && !isNaN(Number(ms))) return Number(ms);
  const sec = headers.get('retry-after');
  if (sec && !isNaN(Number(sec))) return Number(sec) * 1000;
  return undefined;
}

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
        const retryAfterMs = parseRetryAfter(res.headers);
        throw new AIProviderError(
          'anthropic',
          `HTTP ${res.status}: ${body.slice(0, 200)}`,
          res.status,
          retryAfterMs,
        );
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
        const retryAfterMs = parseRetryAfter(res.headers);
        throw new AIProviderError(
          'openai',
          `HTTP ${res.status}: ${body.slice(0, 200)}`,
          res.status,
          retryAfterMs,
        );
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
        const retryAfterMs = parseRetryAfter(res.headers);
        throw new AIProviderError(
          'google',
          `HTTP ${res.status}: ${body.slice(0, 200)}`,
          res.status,
          retryAfterMs,
        );
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

// Simple FIFO semaphore — keep CONCURRENCY in flight, queue the rest.
let inFlight = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (inFlight < CONCURRENCY) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inFlight++;
}

function release(): void {
  inFlight--;
  const next = waiters.shift();
  if (next) next();
}

const MAX_RETRIES_PER_PROVIDER = 2;
const DEFAULT_RETRY_BACKOFF_MS = 30_000;

/** True if the error is worth retrying (rate limit / transient server). */
function isRetriable(err: unknown): err is AIProviderError {
  if (!(err instanceof AIProviderError)) return false;
  if (err.status === undefined) return false;
  return err.status === 429 || err.status === 529 || (err.status >= 500 && err.status < 600);
}

async function callWithRetry(provider: Provider, req: AIRequest): Promise<AIResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_PROVIDER; attempt++) {
    try {
      return await provider.call(req);
    } catch (e) {
      lastError = e;
      if (!isRetriable(e) || attempt === MAX_RETRIES_PER_PROVIDER) throw e;
      const wait = e.retryAfterMs ?? DEFAULT_RETRY_BACKOFF_MS * (attempt + 1);
      console.warn(
        `[ai-router] ${provider.id} ${e.status} retriable, sleeping ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES_PER_PROVIDER})`,
      );
      await sleep(wait);
    }
  }
  // Unreachable, but TypeScript can't see that.
  throw lastError;
}

export async function generate(req: AIRequest): Promise<AIResponse> {
  const providers: Record<ProviderId, Provider> = {
    anthropic: anthropic(process.env.ANTHROPIC_API_KEY),
    openai: openai(process.env.OPENAI_API_KEY),
    google: google(process.env.GEMINI_BUILD_KEY ?? process.env.GEMINI_API_KEY),
  };

  await acquire();
  try {
    const errors: string[] = [];
    for (const id of ORDER) {
      const p = providers[id];
      if (!p.isAvailable) continue;
      try {
        return await callWithRetry(p, req);
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
  } finally {
    release();
  }
}

export function hasAnyAIProvider(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_BUILD_KEY ||
      process.env.GEMINI_API_KEY,
  );
}
