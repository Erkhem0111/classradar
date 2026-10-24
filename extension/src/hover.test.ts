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
  `<a href="command:${command}?${encodeURIComponent(JSON.stringify(args))}">`;

test("card: heading, newest tip with dots, original error, arrow row", () => {
  const md = renderHelp(help, at);
  assert.match(md, /Алдаа · 2-р мөр/);
  assert.match(md, /<h2>Нэр танигдсангүй<\/h2>/);
  assert.ok(md.startsWith('<div align="center">'));
  assert.match(md, /Зөвлөгөө 2\/3<\/b> ●●○ · 🧪 Яаж шалгах вэ/);
  assert.match(md, /<p><b>Хоёр\.<\/b><\/p>/);
  assert.ok(!md.includes("Нэг."));
  assert.match(md, /Эх алдаа: Cannot find name 'totl'\. &lt;x&gt;/);
  assert.ok(md.includes(`${link(SHOW_TIP_COMMAND, ["abc", 0, 1, 12])}◀ Өмнөх</a>`));
  assert.ok(md.includes(`${link(REVEAL_COMMAND, ["abc", 1, 12])}Дараах ▶</a>`));
  assert.ok(md.includes(`${link(UNDERSTOOD_COMMAND, ["abc", 1, 12])}<b>✓ Ойлголоо</b></a>`));
  assert.match(md, /Gemma 4 \(gemma4:e2b\)/);
});

test("first tip: back arrow disabled, forward navigates without revealing", () => {
  const md = renderHelp(help, at, 0);
  assert.match(md, /Зөвлөгөө 1\/3<\/b> ●●○ · 🔍 Хаанаас хайх вэ/);
  assert.match(md, /<b>Нэг\.<\/b>/);
  assert.match(md, /◁ Өмнөх<\/span> &nbsp;·&nbsp; <b>1\/3<\/b>/);
  assert.ok(md.includes(`${link(SHOW_TIP_COMMAND, ["abc", 1, 1, 12])}Дараах ▶</a>`));
  assert.ok(!md.includes(REVEAL_COMMAND));
});

test("understood, and all tips seen", () => {
  const understood = renderHelp({ ...help, understood: true }, at);
  assert.ok(!understood.includes(UNDERSTOOD_COMMAND));
  assert.match(understood, /✅ <b>Ойлгосон!<\/b>/);

  const done = renderHelp(
    { ...help, hints: ["Нэг.", "Хоёр.", "Гурав."], hintsUsed: 3, source: "fallback", model: null },
    at,
  );
  assert.match(done, /Зөвлөгөө 3\/3<\/b> ●●● · 🧠 Цаад санаа/);
  assert.match(done, /<b>3\/3<\/b> &nbsp;·&nbsp; <span style="color:#6E6888;">Дараах ▷/);
  assert.ok(!done.includes(REVEAL_COMMAND));
  assert.match(done, /Бүх зөвлөгөөг харлаа/);
  assert.match(done, /бэлэн тайлбар/);
});

test("server sends all tips, but only opened ones are shown", () => {
  const md = renderHelp({ ...help, hints: ["Нэг.", "Хоёр.", "Гурав."], hintsUsed: 1 }, at);
  assert.match(md, /Нэг\./);
  assert.ok(!md.includes("Хоёр.") && !md.includes("Гурав."));
  assert.ok(md.includes(`${link(REVEAL_COMMAND, ["abc", 1, 12])}Дараах ▶</a>`));
});

test("escapes the message and renders `names` as code", () => {
  const md = renderHelp({ ...help, explanation: "Компьютер `totl` гэсэн нэрийг танихгүй." }, at);
  assert.match(md, /<code>totl<\/code>/);
  assert.match(md, /Эх алдаа: Cannot find name 'totl'\. &lt;x&gt;/);
});
