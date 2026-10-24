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
  `<a href="command:${command}?${encodeURIComponent(JSON.stringify(args))}">${label}</a>`;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Escapes text and turns `name` spans into <code>, since HTML skips Markdown. */
const rich = (text: string) => escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>");

const color = (hex: string, html: string) => `<span style="color:${hex};">${html}</span>`;

const dots = (filled: number, total: number) =>
  "●".repeat(Math.min(filled, total)) + "○".repeat(Math.max(total - filled, 0));

// Hovers shrink to their content; an invisible 480px-wide image keeps the card
// roomy so the centered text has space to breathe.
const SPACER = `<img src="data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="1"/>',
)}" width="480" height="1" alt="">`;

const SEP = " &nbsp;·&nbsp; ";

/**
 * One tip at a time: `view` is the 0-based tip shown (defaults to the newest
 * revealed). `at` is the error position, so commands can reopen the hover there.
 * The card is HTML so it can be centered.
 */
export const renderHelp = (help: ErrorHelp, at: Position, view = help.hintsUsed - 1) => {
  const position = [at.line, at.character];
  // The server sends all tips; only the opened ones may be shown.
  const opened = help.hints.slice(0, help.hintsUsed);
  const shown = Math.min(Math.max(view, 0), opened.length - 1);
  const hint = opened[shown];

  const parts = [
    `<div align="center">`,
    SPACER,
    `<p>${color("#B9A2FF", `🛰️ <b>Алдаа · ${help.line}-р мөр</b>`)}</p>`,
    `<h2>${rich(help.title)}</h2>`,
    `<p>${rich(help.explanation)}</p>`,
  ];

  if (hint !== undefined) {
    const angle = TIP_ANGLES[shown] ?? "";
    parts.push(
      "<hr>",
      `<p>${color("#B9A2FF", `💡 <b>Зөвлөгөө ${shown + 1}/${help.hintsTotal}</b> ${dots(help.hintsUsed, help.hintsTotal)} · ${angle}`)}</p>`,
      `<p><b>${rich(hint)}</b></p>`,
    );
  }

  // Always-visible "◀ Өмнөх · n/3 · Дараах ▶" row; arrows are words too so
  // they are easy to click, and a hollow arrow means "nowhere to go".
  const prev =
    shown > 0
      ? commandLink("◀ Өмнөх", SHOW_TIP_COMMAND, [help.errorId, shown - 1, ...position])
      : color("#6E6888", "◁ Өмнөх");
  const next =
    shown < opened.length - 1
      ? commandLink("Дараах ▶", SHOW_TIP_COMMAND, [help.errorId, shown + 1, ...position])
      : help.hintsUsed < help.hintsTotal
        ? commandLink("Дараах ▶", REVEAL_COMMAND, [help.errorId, ...position])
        : color("#6E6888", "Дараах ▷");
  const actions = [prev, `<b>${Math.max(shown + 1, 1)}/${help.hintsTotal}</b>`, next];
  if (!help.understood) {
    actions.push(commandLink("<b>✓ Ойлголоо</b>", UNDERSTOOD_COMMAND, [help.errorId, ...position]));
  }
  parts.push(`<p>${actions.join(SEP)}</p>`);

  if (help.understood) {
    parts.push(
      `<p>${color("#3FE0B0", "✅ <b>Ойлгосон!</b> Одоо өөрөө засаад, файлаа хадгалаарай.")}</p>`,
    );
  } else if (help.hintsUsed >= help.hintsTotal) {
    parts.push(`<p><i>Бүх зөвлөгөөг харлаа. Гацвал багшаасаа асуугаарай.</i></p>`);
  }

  const source = help.source === "gemma" ? `Gemma 4 (${help.model ?? "gemma"})` : "бэлэн тайлбар";
  parts.push(
    `<p>${color("#8C86A6", `<sub>Эх алдаа: ${escapeHtml(help.message)}</sub>`)}</p>`,
    `<p>${color("#8C86A6", `<sub>Ангийн радар · ${source}</sub>`)}</p>`,
    "</div>",
  );
  return parts.join("\n");
};

// Placeholder bars in the card's shape while the explanation is on its way.
export const SKELETON = [
  `<div align="center">`,
  SPACER,
  `<p>${color("#B9A2FF", "🛰️ <b>Ангийн радар</b>")}</p>`,
  `<h2>${color("#6E6888", "░░░░░░░░░░░░")}</h2>`,
  `<p>${color("#6E6888", "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░<br>░░░░░░░░░░░░░░░░░░")}</p>`,
  `<p>${color("#6E6888", "💡 ░░░░░░░░ ○○○")}</p>`,
  `<p>${color("#8C86A6", "<sub>⏳ Тайлбар бэлдэж байна…</sub>")}</p>`,
  "</div>",
].join("\n");

export const OFFLINE =
  "🛰️ **Ангийн радар**\n\nСервертэй холбогдож чадсангүй. Түр хүлээгээд дахин хулганаа аваачаарай.";
