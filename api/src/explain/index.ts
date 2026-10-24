import { env } from "../config.ts";
import { ClassradarExplanations } from "../models/explanations.ts";
import { type Explanation, fallbackExplanation } from "./fallback.ts";
import { type GemmaConfig, askGemma } from "./gemma.ts";

export type ExplanationSource = "gemma" | "fallback";

export type ErrorExplanation = Explanation & { source: ExplanationSource; model: string | null };

export const gemmaConfig: GemmaConfig | null = env.GEMMA_URL
  ? {
      url: env.GEMMA_URL,
      model: env.GEMMA_MODEL,
      apiKey: env.GEMMA_API_KEY,
      timeoutMs: env.GEMMA_TIMEOUT_MS,
    }
  : null;

// Students in one class hit the same error at once; share one Gemma call.
const inFlight = new Map<string, Promise<ErrorExplanation>>();

const fromFallback = (message: string): ErrorExplanation => {
  const { title, explanation, hints } = fallbackExplanation(message);
  return { title, explanation, hints, source: "fallback", model: null };
};

const fromCache = async (subdomain: string, normalizedKey: string, message: string) => {
  const cached = await ClassradarExplanations.findOne({ subdomain, normalizedKey }).lean();
  if (!cached || cached.hints.length !== 3) return null;
  const [a = "", b = "", c = ""] = cached.hints;
  return {
    // Entries cached before titles existed borrow the built-in one.
    title: cached.title || fallbackExplanation(message).title,
    explanation: cached.explanation,
    hints: [a, b, c],
    source: "gemma",
    model: cached.model,
  } satisfies ErrorExplanation;
};

const generate = async (
  subdomain: string,
  normalizedKey: string,
  message: string,
): Promise<ErrorExplanation> => {
  const cached = await fromCache(subdomain, normalizedKey, message);
  if (cached) return cached;
  if (!gemmaConfig) return fromFallback(message);

  const answer = await askGemma(gemmaConfig, message);
  if (!answer) {
    console.warn(
      `classradar: Gemma unavailable for "${normalizedKey}", using built-in explanation`,
    );
    return fromFallback(message);
  }
  // Only Gemma answers are cached, so a later call can still upgrade a fallback.
  await ClassradarExplanations.updateOne(
    { subdomain, normalizedKey },
    { $setOnInsert: { ...answer, model: gemmaConfig.model, createdAt: new Date() } },
    { upsert: true },
  );
  return { ...answer, source: "gemma", model: gemmaConfig.model };
};

/** Waits for Gemma (deduped per error kind); used to warm the cache. */
export const explainError = (subdomain: string, normalizedKey: string, message: string) => {
  const key = `${subdomain}\u0000${normalizedKey}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = generate(subdomain, normalizedKey, message).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
};

/**
 * Never waits for Gemma: the cached Gemma answer if there is one, else the
 * built-in explanation right away while Gemma is asked in the background, so
 * the next look at this kind of error gets Gemma's answer.
 */
export const explainNow = async (subdomain: string, normalizedKey: string, message: string) => {
  const cached = await fromCache(subdomain, normalizedKey, message);
  if (cached) return cached;
  if (gemmaConfig) {
    void explainError(subdomain, normalizedKey, message).catch((error: unknown) =>
      console.error("classradar: background explanation failed", error),
    );
  }
  return fromFallback(message);
};
