// Pure Markdown for the hover, no `vscode` import, so it can be unit tested.
// Layout follows the design card: heading, explanation, one tip with dots,
// the original error, then the actions.
import type { ErrorHelp } from "./client";

/** Reveals the next tip on the server (counts toward hintsUsed). */
export const REVEAL_COMMAND = "classradar.revealHint";
/** Switches between tips already revealed; no server call. */
export const SHOW_TIP_COMMAND = "classradar.showTip";
/** Student says they understood; recorded for the teacher. */
export const UNDERSTOOD_COMMAND = "classradar.markUnderstood";

export const HOVER_COMMANDS = [REVEAL_COMMAND, SHOW_TIP_COMMAND, UNDERSTOOD_COMMAND];

/** Each tip looks at the error from its own angle, in this order. */
const TIP_ANGLES = ["🔍 Хаанаас хайх вэ", "🧪 Яаж шалгах вэ", "🧠 Цаад санаа"];

type Position = { line: number; character: number };

const commandLink = (label: string, command: string, args: unknown[]) =>
  `[${label}](command:${command}?${encodeURIComponent(JSON.stringify(args))})`;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const dots = (filled: number, total: number) =>
  "●".repeat(Math.min(filled, total)) + "○".repeat(Math.max(total - filled, 0));

/**
 * One tip at a time: `view` is the 0-based tip shown (defaults to the newest
 * revealed). `at` is the error position, so commands can reopen the hover there.
 */
export const renderHelp = (help: ErrorHelp, at: Position, view = help.hintsUsed - 1) => {
  const position = [at.line, at.character];
  const parts = [
    `🛰️ **Алдаа · ${help.line}-р мөр**`,
    "",
    `### ${help.title}`,
    "",
    help.explanation,
  ];

  const shown = Math.min(Math.max(view, 0), help.hints.length - 1);
  const hint = help.hints[shown];
  if (hint !== undefined) {
    const angle = TIP_ANGLES[shown] ?? "";
    parts.push(
      "",
      `💡 **Зөвлөгөө ${shown + 1}/${help.hintsTotal}** ${dots(help.hintsUsed, help.hintsTotal)} · ${angle}`,
      "",
      hint,
    );
  }

  parts.push("", `<sub>Эх алдаа: ${escapeHtml(help.message)}</sub>`);

  // Always-visible "◀ Өмнөх · n/3 · Дараах ▶" row; arrows are words too so
  // they are easy to click, and a hollow arrow means "nowhere to go".
  const prev =
    shown > 0
      ? commandLink("◀ Өмнөх", SHOW_TIP_COMMAND, [help.errorId, shown - 1, ...position])
      : "◁ Өмнөх";
  const next =
    shown < help.hints.length - 1
      ? commandLink("Дараах ▶", SHOW_TIP_COMMAND, [help.errorId, shown + 1, ...position])
      : help.hintsUsed < help.hintsTotal
        ? commandLink("Дараах ▶", REVEAL_COMMAND, [help.errorId, ...position])
        : "Дараах ▷";
  const actions = [prev, `**${Math.max(shown + 1, 1)}/${help.hintsTotal}**`, next];
  if (!help.understood) {
    actions.push(commandLink("✓ Ойлголоо", UNDERSTOOD_COMMAND, [help.errorId, ...position]));
  }
  parts.push("", actions.join("  ·  "));

  if (help.understood) {
    parts.push("", "✅ **Ойлгосон!** Одоо өөрөө засаад, файлаа хадгалаарай.");
  } else if (help.hintsUsed >= help.hintsTotal) {
    parts.push("", "_Бүх зөвлөгөөг харлаа. Гацвал багшаасаа асуугаарай._");
  }

  const source = help.source === "gemma" ? `Gemma 4 (${help.model ?? "gemma"})` : "бэлэн тайлбар";
  parts.push("", `<sub>Ангийн радар · ${source}</sub>`);
  return parts.join("\n");
};

export const OFFLINE =
  "🛰️ **Ангийн радар**\n\nСервертэй холбогдож чадсангүй. Түр хүлээгээд дахин хулганаа аваачаарай.";
