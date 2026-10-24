import { z } from "zod";
import type { Explanation } from "./fallback.ts";

export type GemmaConfig = {
  /** OpenAI-compatible base URL, e.g. http://localhost:11434/v1 (Ollama). */
  url: string;
  model: string;
  apiKey?: string;
  timeoutMs: number;
};

const SYSTEM_PROMPT = `Чи 13-18 насны програмчлал сурч буй сурагчдад туслах багш.
Сурагч англи хэл дээрх алдааны мессеж явуулна. Чи:
- "explanation": алдаа юу гэсэн үг болохыг 1-2 өгүүлбэрээр энгийн монгол хэлээр тайлбарла.
- "hints": яг 3 зөвлөгөө, тус бүр 1 өгүүлбэр, өөр өөр өнцгөөс, давхардалгүй:
  1) Кодын хаана нь хайх вэ. 2) Яаж шалгаж, туршиж үзэх вэ. 3) Энэ алдааны цаад санаа, дүрэм.
ХАТУУ ДҮРЭМ: хариуг хэзээ ч шууд бүү хэл, засварласан код бүү бич, код блок бүү ашигла.
Сурагч өөрөө олох ёстой. Зөвхөн JSON буцаа: {"explanation": "...", "hints": ["...", "...", "..."]}`;

const sentence = z.string().trim().min(5).max(400);

const explanationSchema = z.object({
  explanation: sentence,
  hints: z.tuple([sentence, sentence, sentence]),
});

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

// A hint that carries code is likely the answer in disguise.
const looksLikeCode = (text: string) =>
  /```|\n\s{2,}\S|;\s*$|=>|\bdef\s+\w+\(|\bprint\(/m.test(text);

/** Pulls the first JSON object out of a reply that may wrap it in prose or fences. */
const extractJson = (content: string) => {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  return start === -1 || end <= start ? null : content.slice(start, end + 1);
};

export const parseGemmaReply = (content: string): Explanation | null => {
  const json = extractJson(content);
  if (!json) return null;
  try {
    const result = explanationSchema.safeParse(JSON.parse(json));
    if (!result.success) return null;
    const { explanation, hints } = result.data;
    if ([explanation, ...hints].some(looksLikeCode)) return null;
    return { explanation, hints };
  } catch {
    return null;
  }
};

/**
 * Asks Gemma 4 for an explanation of one error message. Only the message is
 * sent — never the student's code. Returns null on any failure or timeout so
 * the caller falls back to the built-in explanations.
 */
export const askGemma = async (
  config: GemmaConfig,
  message: string,
): Promise<Explanation | null> => {
  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Алдааны мессеж: ${message}` },
        ],
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) return null;
    const completion = completionSchema.safeParse(await response.json());
    return completion.success
      ? parseGemmaReply(completion.data.choices[0]?.message.content ?? "")
      : null;
  } catch {
    return null;
  }
};
