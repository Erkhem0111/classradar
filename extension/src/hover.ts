// Pure Markdown for the hover, no `vscode` import, so it can be unit tested.
import type { ErrorHelp } from "./client";

export const REVEAL_COMMAND = "classradar.revealHint";

/** Each tip looks at the error from its own angle, in this order. */
const TIP_TITLES = ["🔍 Хаанаас хайх вэ", "🧪 Яаж шалгах вэ", "🧠 Цаад санаа"];

/** `at` is the error position, so the reveal command can reopen the hover there. */
export const renderHelp = (help: ErrorHelp, at: { line: number; character: number }) => {
  const parts = [`**🛰️ Ангийн радар**`, "", help.explanation, ""];

  // The link sits right under the explanation and the newest tip right under
  // the link: hovers are height-limited, so anything lower may stay hidden.
  if (help.hintsUsed < help.hintsTotal) {
    const args = encodeURIComponent(JSON.stringify([help.errorId, at.line, at.character]));
    const label = help.hintsUsed === 0 ? "Зөвлөгөө авах" : "Дараагийн зөвлөгөө";
    parts.push(
      `[💡 ${label} (${help.hintsUsed + 1}/${help.hintsTotal})](command:${REVEAL_COMMAND}?${args})`,
    );
  } else {
    parts.push("_Бүх зөвлөгөөг харлаа. Одоо өөрөө оролдоод үз! Гацвал багшаасаа асуугаарай._");
  }

  help.hints
    .map((hint, index) => {
      const title = TIP_TITLES[index] ?? `Зөвлөгөө ${index + 1}`;
      return `**${title}** (${index + 1}/${help.hintsTotal}): ${hint}`;
    })
    .reverse()
    .forEach((tip) => parts.push("", tip));

  const source = help.source === "gemma" ? `Gemma 4 (${help.model ?? "gemma"})` : "бэлэн тайлбар";
  parts.push("", `<sub>Тайлбар: ${source}</sub>`);
  return parts.join("\n");
};

export const NOT_SENT_YET =
  "**🛰️ Ангийн радар**\n\nФайлаа хадгална уу (Ctrl+S) — дараа нь энд монгол тайлбар гарна.";
export const OFFLINE =
  "**🛰️ Ангийн радар**\n\nСервертэй холбогдож чадсангүй. Түр хүлээгээд дахин хулганаа аваачаарай.";
