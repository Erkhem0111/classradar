// Pure Markdown for the hover, no `vscode` import, so it can be unit tested.
import type { ErrorHelp } from "./client";

/** Reveals the next tip on the server (counts toward hintsUsed). */
export const REVEAL_COMMAND = "classradar.revealHint";
/** Switches between tips already revealed; no server call. */
export const SHOW_TIP_COMMAND = "classradar.showTip";

/** Each tip looks at the error from its own angle, in this order. */
const TIP_TITLES = ["🔍 Хаанаас хайх вэ", "🧪 Яаж шалгах вэ", "🧠 Цаад санаа"];

type Position = { line: number; character: number };

const commandLink = (label: string, command: string, args: unknown[]) =>
  `[${label}](command:${command}?${encodeURIComponent(JSON.stringify(args))})`;

/**
 * One tip at a time: `view` is the 0-based tip shown (defaults to the newest
 * revealed). `at` is the error position, so commands can reopen the hover there.
 */
export const renderHelp = (help: ErrorHelp, at: Position, view = help.hintsUsed - 1) => {
  const parts = [`**🛰️ Ангийн радар**`, "", help.explanation];
  const shown = Math.min(Math.max(view, 0), help.hints.length - 1);
  const position = [at.line, at.character];

  const hint = help.hints[shown];
  if (hint !== undefined) {
    const title = TIP_TITLES[shown] ?? `Зөвлөгөө ${shown + 1}`;
    parts.push("", `💡 **${title}** (${shown + 1}/${help.hintsTotal})`, "", hint);
  }

  const nav: string[] = [];
  if (shown > 0) {
    nav.push(commandLink("◀ Өмнөх", SHOW_TIP_COMMAND, [help.errorId, shown - 1, ...position]));
  }
  if (shown < help.hints.length - 1) {
    nav.push(commandLink("Дараагийн ▶", SHOW_TIP_COMMAND, [help.errorId, shown + 1, ...position]));
  } else if (help.hintsUsed < help.hintsTotal) {
    const label = help.hintsUsed === 0 ? "💡 Зөвлөгөө авах" : "Шинэ зөвлөгөө ▶";
    nav.push(
      commandLink(`${label} (${help.hintsUsed + 1}/${help.hintsTotal})`, REVEAL_COMMAND, [
        help.errorId,
        ...position,
      ]),
    );
  }
  if (nav.length > 0) parts.push("", nav.join("  ·  "));
  if (help.hintsUsed >= help.hintsTotal && shown === help.hints.length - 1) {
    parts.push("", "_Бүх зөвлөгөөг харлаа. Одоо өөрөө оролдоод үз! Гацвал багшаасаа асуугаарай._");
  }

  const source = help.source === "gemma" ? `Gemma 4 (${help.model ?? "gemma"})` : "бэлэн тайлбар";
  parts.push("", `<sub>Тайлбар: ${source}</sub>`);
  return parts.join("\n");
};

export const NOT_SENT_YET =
  "**🛰️ Ангийн радар**\n\nФайлаа хадгална уу (Ctrl+S) — дараа нь энд монгол тайлбар гарна.";
export const OFFLINE =
  "**🛰️ Ангийн радар**\n\nСервертэй холбогдож чадсангүй. Түр хүлээгээд дахин хулганаа аваачаарай.";
