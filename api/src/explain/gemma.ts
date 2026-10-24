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
- "title": асуудлыг 2-4 үгээр нэрлэ (жишээ нь "Хаалт хаагдаагүй байна").
- "explanation": алдаа юу гэсэн үг болохыг 1-2 өгүүлбэрээр энгийн монгол хэлээр тайлбарла.
- "hints": яг 3 зөвлөгөө, тус бүр 1 өгүүлбэр, өөр өөр өнцгөөс, давхардалгүй:
  1) Кодын хаана нь хайх вэ. 2) Яаж шалгаж, туршиж үзэх вэ. 3) Энэ алдааны цаад санаа, дүрэм.
ХАТУУ ДҮРЭМ: хариуг хэзээ ч шууд бүү хэл, зөв нэр эсвэл засварласан код бүү бич, код блок бүү ашигла.
Сурагч өөрөө олох ёстой. Зөвхөн JSON буцаа: {"title": "...", "explanation": "...", "hints": ["...", "...", "..."]}`;

const sentence = z.string().trim().min(5).max(400);

const explanationSchema = z.object({
  title: z.string().trim().min(2).max(60),
  explanation: sentence,
  hints: z.tuple([sentence, sentence, sentence]),
});

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

// A hint that carries code is likely the answer in disguise.
const looksLikeCode = (text: string) =>
  /```|\n\s{2,}\S|;\s*$|=>|\bdef\s+\w+\(|\bprint\(/m.test(text);

/**
 * Pulls the JSON object out of a reply that may wrap it in prose or fences.
 * Gemma 4 first writes its reasoning in <thought>…</thought>, which can quote
 * the JSON template too, so that part is dropped.
 */
export const extractJson = (reply: string) => {
  const content = reply.replace(/<thought>[\s\S]*?<\/thought>/g, "");
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  return start === -1 || end <= start ? null : content.slice(start, end + 1);
};

/** The compiler's own suggestion ("Did you mean 'total'?") is the answer. */
const suggestedFix = (message: string) => /did you mean ['"`]([^'"`]+)['"`]/i.exec(message)?.[1];

export const parseGemmaReply = (content: string, message = ""): Explanation | null => {
  const json = extractJson(content);
  if (!json) return null;
  try {
    const result = explanationSchema.safeParse(JSON.parse(json));
    if (!result.success) return null;
    const { title, explanation, hints } = result.data;
    const texts = [title, explanation, ...hints];
    if (texts.some(looksLikeCode)) return null;
    const fix = suggestedFix(message);
    if (fix && texts.some((text) => text.includes(fix))) return null;
    return { title, explanation, hints };
  } catch {
    return null;
  }
};

/**
 * One chat completion that should come back as JSON. Ollama takes a system
 * message and JSON mode; Gemma on Google's API takes neither, so a rejected
 * request is retried with the prompt inline. Returns the raw reply text, or
 * null on any failure or timeout.
 */
export const completeJson = async (
  config: GemmaConfig,
  systemPrompt: string,
  user: string,
): Promise<string | null> => {
  const attempts = [
    {
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: user },
      ],
    },
    { messages: [{ role: "user", content: `${systemPrompt}\n\n${user}` }] },
  ];
  const deadline = AbortSignal.timeout(config.timeoutMs);
  // WSL and some school networks drop the odd connection: retry once while
  // the deadline allows.
  for (let round = 0; round < 2; round += 1) {
    const reply = await tryAttempts(config, attempts, deadline);
    if (reply !== "network") return reply;
    if (deadline.aborted) return null;
  }
  return null;
};

const tryAttempts = async (
  config: GemmaConfig,
  attempts: Record<string, unknown>[],
  deadline: AbortSignal,
): Promise<string | null | "network"> => {
  try {
    for (const attempt of attempts) {
      const response = await fetch(`${config.url.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: config.model, temperature: 0.3, ...attempt }),
        signal: deadline,
      });
      if (response.status === 400) continue;
      if (!response.ok) {
        console.warn(`classradar: Gemma replied HTTP ${response.status}`);
        return null;
      }
      const completion = completionSchema.safeParse(await response.json());
      return completion.success ? (completion.data.choices[0]?.message.content ?? null) : null;
    }
    return null;
  } catch (error) {
    console.warn(
      "classradar: Gemma request failed:",
      error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : error,
    );
    return deadline.aborted ? null : "network";
  }
};

/**
 * Asks Gemma 4 for an explanation of one error message. Only the message is
 * sent — never the student's code. Returns null on any failure or timeout so
 * the caller falls back to the built-in explanations.
 */
export const askGemma = async (config: GemmaConfig, message: string) => {
  const reply = await completeJson(config, SYSTEM_PROMPT, `Алдааны мессеж: ${message}`);
  return reply === null ? null : parseGemmaReply(reply, message);
};
