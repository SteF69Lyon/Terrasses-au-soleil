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

const MAX_FULL_PASSES = 2;
const DEFAULT_RETRY_BACKOFF_MS = 30_000;

/** Rate-limit / overload — fall through to next provider immediately. */
function isRateLimited(err: unknown): err is AIProviderError {
  if (!(err instanceof AIProviderError)) return false;
  return err.status === 429 || err.status === 529;
}

/** Genuine transient server error — retry the same provider once. */
function isTransient5xx(err: unknown): err is AIProviderError {
  if (!(err instanceof AIProviderError)) return false;
  if (err.status === undefined) return false;
  if (err.status === 529) return false; // 529 is rate-limit-ish
  return err.status >= 500 && err.status < 600;
}

async function callOnceWithMicroRetry(provider: Provider, req: AIRequest): Promise<AIResponse> {
  // Single retry only for genuine 5xx (not 429 — those bounce to next provider).
  try {
    return await provider.call(req);
  } catch (e) {
    if (!isTransient5xx(e)) throw e;
    console.warn(`[ai-router] ${provider.id} ${e.status} transient, retrying once after 2s`);
    await sleep(2_000);
    return await provider.call(req);
  }
}

export async function generate(req: AIRequest): Promise<AIResponse> {
  const providers: Record<ProviderId, Provider> = {
    anthropic: anthropic(process.env.ANTHROPIC_API_KEY),
    openai: openai(process.env.OPENAI_API_KEY),
    google: google(process.env.GEMINI_BUILD_KEY ?? process.env.GEMINI_API_KEY),
  };

  await acquire();
  try {
    let lastErrors: string[] = [];
    let waitMsForNextPass = 0;

    for (let pass = 0; pass < MAX_FULL_PASSES; pass++) {
      // Backoff between full passes, only when all providers were rate-limited.
      if (pass > 0 && waitMsForNextPass > 0) {
        console.warn(
          `[ai-router] all providers rate-limited, sleeping ${Math.round(waitMsForNextPass / 1000)}s before pass ${pass + 1}/${MAX_FULL_PASSES}`,
        );
        await sleep(waitMsForNextPass);
      }

      const passErrors: string[] = [];
      let maxRetryAfterMs = 0;
      let everySingleFailureIsRateLimit = true;

      for (const id of ORDER) {
        const p = providers[id];
        if (!p.isAvailable) continue;
        try {
          return await callOnceWithMicroRetry(p, req);
        } catch (e) {
          const err = e as AIProviderError;
          const msg = (e as Error).message;
          console.warn(`[ai-router] ${id} failed: ${msg}`);
          passErrors.push(`${id}: ${msg}`);
          if (isRateLimited(err)) {
            if (err.retryAfterMs && err.retryAfterMs > maxRetryAfterMs) {
              maxRetryAfterMs = err.retryAfterMs;
            }
          } else {
            everySingleFailureIsRateLimit = false;
          }
        }
      }

      lastErrors = passErrors;

      // If no provider was even available, fail fast — retrying won't help.
      if (passErrors.length === 0) {
        throw new Error(
          'No AI provider configured. Set at least one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_BUILD_KEY.',
        );
      }

      // Only retry the whole chain if the failures were all rate-limits.
      // If any provider returned 4xx auth/badreq, more passes won't help.
      if (!everySingleFailureIsRateLimit) break;

      waitMsForNextPass = maxRetryAfterMs > 0 ? maxRetryAfterMs : DEFAULT_RETRY_BACKOFF_MS;
    }

    throw new Error(`All AI providers failed. Tried: ${lastErrors.join(' · ')}`);
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
