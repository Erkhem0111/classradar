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

/** A pill: VS Code hovers allow only color and background-color on spans. */
const pill = (fg: string, bg: string, html: string) =>
  `<span style="color:${fg};background-color:${bg};">&nbsp;&nbsp;${html}&nbsp;&nbsp;</span>`;

/**
 * The card from the extension design (Extension@1x): status line with the
 * "erxes радар" badge, title, explanation, the tip in a framed box with its
 * progress dots, the original error, and the actions bottom right.
 * `view` is the 0-based tip shown (defaults to the newest revealed); `at` is
 * the error position, so commands can reopen the hover there.
 */
export const renderHelp = (help: ErrorHelp, at: Position, view = help.hintsUsed - 1) => {
  const position = [at.line, at.character];
  // The server sends all tips; only the opened ones may be shown.
  const opened = help.hints.slice(0, help.hintsUsed);
  const shown = Math.min(Math.max(view, 0), opened.length - 1);
  const hint = opened[shown];

  const parts = [
    SPACER,
    `<table width="100%"><tr>` +
      `<td>${color("#FF9A7A", `○ <b>Алдаа · ${help.line}-р мөр</b>`)}</td>` +
      `<td align="right">${pill("#C9B8FF", "#2A1A56", "erxes радар")}</td>` +
      `</tr></table>`,
    `<h3>${rich(help.title)}</h3>`,
    `<p>${rich(help.explanation)}</p>`,
  ];

  if (hint !== undefined) {
    const angle = TIP_ANGLES[shown] ?? "";
    // ◀ ▶ move between tips already opened; no server call.
    const prev =
      shown > 0
        ? commandLink("◀", SHOW_TIP_COMMAND, [help.errorId, shown - 1, ...position])
        : color("#4A4560", "◀");
    const next =
      shown < opened.length - 1
        ? commandLink("▶", SHOW_TIP_COMMAND, [help.errorId, shown + 1, ...position])
        : color("#4A4560", "▶");
    parts.push(
      `<blockquote>` +
        `<p>${color("#C9B8FF", `<b>Зөвлөгөө ${shown + 1}/${help.hintsTotal}</b>`)} ` +
        `${color("#9B84EE", dots(help.hintsUsed, help.hintsTotal))} &nbsp;${prev}&nbsp;${next}` +
        ` &nbsp;${color("#8C86A6", angle)}</p>` +
        `<p>${rich(hint)}</p>` +
        `</blockquote>`,
    );
  }

  parts.push(`<p>${color("#8C86A6", `Эх алдаа: <code>${escapeHtml(help.message)}</code>`)}</p>`);

  const actions: string[] = [];
  if (help.hintsUsed < help.hintsTotal) {
    const label = help.hintsUsed === 0 ? "Зөвлөгөө авах" : "Өөр зөвлөгөө";
    actions.push(
      commandLink(pill("#E3DEF2", "#2A1A56", label), REVEAL_COMMAND, [help.errorId, ...position]),
    );
  }
  if (help.understood) {
    actions.push(pill("#0B2A22", "#3FE0B0", "✓ Ойлгосон"));
  } else {
    actions.push(
      commandLink(pill("#FFFFFF", "#7C4DFF", "<b>Ойлголоо</b>"), UNDERSTOOD_COMMAND, [
        help.errorId,
        ...position,
      ]),
    );
  }
  parts.push(`<p align="right">${actions.join("&nbsp;&nbsp;")}</p>`);

  if (!help.understood && help.hintsUsed >= help.hintsTotal) {
    parts.push(
      `<p>${color("#A9A3BF", "<i>Бүх зөвлөгөөг харлаа. Гацвал багшаасаа асуугаарай.</i>")}</p>`,
    );
  }

  const source = help.source === "gemma" ? `Gemma 4 (${help.model ?? "gemma"})` : "бэлэн тайлбар";
  parts.push(`<p>${color("#6E6888", `<sub>Тайлбар: ${source}</sub>`)}</p>`);
  return parts.join("\n");
};

// Placeholder bars in the card's shape while the explanation is on its way.
export const SKELETON = [
  SPACER,
  `<table width="100%"><tr><td>${color("#6E6888", "○ ░░░░░░░░░")}</td><td align="right">${pill("#C9B8FF", "#2A1A56", "erxes радар")}</td></tr></table>`,
  `<h2>${color("#6E6888", "░░░░░░░░░░░░")}</h2>`,
  `<p>${color("#6E6888", "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░<br>░░░░░░░░░░░░░░░░░░")}</p>`,
  `<p>${color("#6E6888", "💡 ░░░░░░░░ ○○○")}</p>`,
  `<p>${color("#8C86A6", "<sub>⏳ Тайлбар бэлдэж байна…</sub>")}</p>`,
].join("\n");

export const OFFLINE =
  "🛰️ **Ангийн радар**\n\nСервертэй холбогдож чадсангүй. Түр хүлээгээд дахин хулганаа аваачаарай.";
