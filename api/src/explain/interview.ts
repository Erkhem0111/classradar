import { z } from "zod";
import { completeJson, extractJson } from "./gemma.ts";
import { gemmaConfig } from "./index.ts";

// Feedback on one interview-practice answer. Gemma 4 grades it like a kind HR
// coach; a simple structure check stands in when Gemma is slow or down.

export type InterviewFeedback = {
  score: number;
  good: string;
  improve: string;
  source: "gemma" | "fallback";
};

const PROMPT = `Чи 13-18 насны сурагчид ажлын ярилцлагын дасгал хийлгэж буй эелдэг HR дасгалжуулагч.
Асуулт ба сурагчийн хариултыг үнэл. Энгийн монгол хэлээр, урам өгөхүйц бич.
- "score": 0-100 бүхэл тоо (тодорхой жишээ, нөхцөл-үйлдэл-үр дүн бүтэц, асуултад хариулсан эсэх).
- "good": хариултын сайн тал, 1 өгүүлбэр.
- "improve": яг юуг сайжруулах вэ, 1 өгүүлбэр. Бэлэн хариулт бүү бич.
Зөвхөн JSON буцаа: {"score": 0, "good": "...", "improve": "..."}`;

const replySchema = z.object({
  score: z.coerce.number().int().min(0).max(100),
  good: z.string().trim().min(3).max(300),
  improve: z.string().trim().min(3).max(300),
});

/** Rewards a concrete, situation-action-result answer. */
export const ruleFeedback = (answer: string): InterviewFeedback => {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const hasExample = /жишээ|нэг удаа|тэр үед|төсөл|даалгавар/i.test(answer);
  const hasResult = /үр дүн|чадсан|сурсан|амжилт|дууссан/i.test(answer);
  const score = Math.min(
    100,
    Math.round(words * 2.5) + (hasExample ? 20 : 0) + (hasResult ? 20 : 0),
  );
  return {
    score,
    good: words >= 15 ? "Хангалттай дэлгэрэнгүй ярьсан." : "Асуултад хариулахыг оролдсон.",
    improve: !hasExample
      ? "Бодит жишээ нэмээрэй."
      : !hasResult
        ? "Эцэст нь юу болсон, юу сурснаа хэлээрэй."
        : "Нөхцөл, үйлдэл, үр дүнгээ илүү тодорхой дараалуулаарай.",
    source: "fallback",
  };
};

export const interviewFeedback = async (
  question: string,
  answer: string,
): Promise<InterviewFeedback> => {
  if (!answer.trim()) {
    return { score: 0, good: "—", improve: "Энэ асуултад хариулаагүй байна.", source: "fallback" };
  }
  if (!gemmaConfig) return ruleFeedback(answer);
  const reply = await completeJson(
    gemmaConfig,
    PROMPT,
    `Асуулт: ${question}\nСурагчийн хариулт: ${answer}`,
  );
  const json = reply === null ? null : extractJson(reply);
  if (json) {
    try {
      const parsed = replySchema.safeParse(JSON.parse(json));
      if (parsed.success) return { ...parsed.data, source: "gemma" };
    } catch {
      // fall through to the rule check
    }
  }
  return ruleFeedback(answer);
};
