// Pure Markdown for the hover, no `vscode` import, so it can be unit tested.
import type { ErrorHelp } from "./client";

export const REVEAL_COMMAND = "classradar.revealHint";

/** `at` is the error position, so the reveal command can reopen the hover there. */
export const renderHelp = (help: ErrorHelp, at: { line: number; character: number }) => {
  const parts = [`**🛰️ Ангийн радар**`, "", help.explanation];
  help.hints.forEach((hint, index) => {
    parts.push("", `💡 **Сэжүүр ${index + 1}/${help.hintsTotal}:** ${hint}`);
  });
  if (help.hintsUsed < help.hintsTotal) {
    const args = encodeURIComponent(JSON.stringify([help.errorId, at.line, at.character]));
    parts.push(
      "",
      `[💡 Сэжүүр харах (${help.hintsUsed + 1}/${help.hintsTotal})](command:${REVEAL_COMMAND}?${args})`,
    );
  } else {
    parts.push("", "_Бүх сэжүүрийг харлаа. Одоо өөрөө оролдоод үз! Гацвал багшаасаа асуугаарай._");
  }
  const source = help.source === "gemma" ? `Gemma 4 (${help.model ?? "gemma"})` : "бэлэн тайлбар";
  parts.push("", `<sub>Тайлбар: ${source}</sub>`);
  return parts.join("\n");
};

export const NOT_SENT_YET =
  "**🛰️ Ангийн радар**\n\nФайлаа хадгална уу (Ctrl+S) — дараа нь энд монгол тайлбар гарна.";
export const OFFLINE =
  "**🛰️ Ангийн радар**\n\nСервертэй холбогдож чадсангүй. Түр хүлээгээд дахин хулганаа аваачаарай.";
