import assert from "node:assert/strict";
import { test } from "node:test";
import { REVEAL_COMMAND, SHOW_TIP_COMMAND, UNDERSTOOD_COMMAND, renderHelp } from "./hover.ts";

const help = {
  errorId: "abc",
  message: "Cannot find name 'totl'. <x>",
  line: 2,
  title: "Нэр танигдсангүй",
  explanation: "Тайлбар.",
  hints: ["Нэг.", "Хоёр."],
  hintsUsed: 2,
  hintsTotal: 3,
  understood: false,
  source: "gemma" as const,
  model: "gemma4:e2b",
};
const at = { line: 1, character: 12 };
const link = (command: string, args: unknown[]) =>
  `(command:${command}?${encodeURIComponent(JSON.stringify(args))})`;

test("card: heading, newest tip with dots, original error, actions", () => {
  const md = renderHelp(help, at);
  assert.match(md, /Алдаа · 2-р мөр/);
  assert.match(md, /### Нэр танигдсангүй/);
  assert.match(md, /Зөвлөгөө 2\/3\*\* ●●○ · 🧪 Яаж шалгах вэ\n\nХоёр\./);
  assert.ok(!md.includes("Нэг."));
  assert.match(md, /Эх алдаа: Cannot find name 'totl'\. &lt;x&gt;/);
  assert.ok(md.includes(`◀ Өмнөх]${link(SHOW_TIP_COMMAND, ["abc", 0, 1, 12])}`));
  assert.ok(md.includes(`Өөр зөвлөгөө ▶ (3/3)]${link(REVEAL_COMMAND, ["abc", 1, 12])}`));
  assert.ok(md.includes(`✓ Ойлголоо]${link(UNDERSTOOD_COMMAND, ["abc", 1, 12])}`));
  assert.match(md, /Gemma 4 \(gemma4:e2b\)/);
});

test("older tip navigates forward without revealing", () => {
  const md = renderHelp(help, at, 0);
  assert.match(md, /Зөвлөгөө 1\/3\*\* ●●○ · 🔍 Хаанаас хайх вэ\n\nНэг\./);
  assert.ok(md.includes(`Дараагийн ▶]${link(SHOW_TIP_COMMAND, ["abc", 1, 1, 12])}`));
  assert.ok(!md.includes(REVEAL_COMMAND));
});

test("no tips yet; understood; all seen", () => {
  const none = renderHelp({ ...help, hints: [], hintsUsed: 0 }, at);
  assert.match(none, /💡 Зөвлөгөө авах \(1\/3\)/);
  assert.match(none, /✓ Ойлголоо/);

  const understood = renderHelp({ ...help, understood: true }, at);
  assert.ok(!understood.includes(UNDERSTOOD_COMMAND));
  assert.match(understood, /✅ \*\*Ойлгосон!\*\*/);

  const done = renderHelp(
    { ...help, hints: ["Нэг.", "Хоёр.", "Гурав."], hintsUsed: 3, source: "fallback", model: null },
    at,
  );
  assert.match(done, /Зөвлөгөө 3\/3\*\* ●●● · 🧠 Цаад санаа/);
  assert.ok(!done.includes(REVEAL_COMMAND));
  assert.match(done, /Бүх зөвлөгөөг харлаа/);
  assert.match(done, /бэлэн тайлбар/);
});
