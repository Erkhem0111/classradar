import assert from "node:assert/strict";
import { test } from "node:test";
import { REVEAL_COMMAND, SHOW_TIP_COMMAND, UNDERSTOOD_COMMAND, renderHelp } from "./hover.ts";

const help = {
  errorId: "abc",
  message: "Cannot find name 'totl'. <x>",
  line: 2,
  title: "Нэр танигдсангүй",
  explanation: "Компьютер `totl` гэсэн нэрийг танихгүй.",
  hints: ["Нэг.", "Хоёр.", "Гурав."],
  hintsUsed: 2,
  hintsTotal: 3,
  understood: false,
  source: "gemma" as const,
  model: "gemma4:e2b",
};
const at = { line: 1, character: 12 };
const link = (command: string, args: unknown[]) =>
  `<a href="command:${command}?${encodeURIComponent(JSON.stringify(args))}">`;

test("design card: status, badge, title, framed tip, original error, actions", () => {
  const md = renderHelp(help, at);
  assert.match(md, /Алдаа · 2-р мөр/);
  assert.match(md, /erxes радар/);
  assert.match(md, /<h3>Нэр танигдсангүй<\/h3>/);
  assert.match(md, /<code>totl<\/code>/);
  assert.match(md, /<blockquote>.*Зөвлөгөө 2\/3.*●●○.*<p>Хоёр\.<\/p><\/blockquote>/s);
  assert.ok(!md.includes("Нэг.") && !md.includes("Гурав."));
  assert.match(md, /Эх алдаа: <code>Cannot find name 'totl'\. &lt;x&gt;<\/code>/);
  assert.ok(md.includes(`${link(SHOW_TIP_COMMAND, ["abc", 0, 1, 12])}◀</a>`));
  assert.ok(md.includes(link(REVEAL_COMMAND, ["abc", 1, 12])));
  assert.match(md, /Өөр зөвлөгөө/);
  assert.ok(md.includes(link(UNDERSTOOD_COMMAND, ["abc", 1, 12])));
  assert.match(md, /Gemma 4 \(gemma4:e2b\)/);
});

test("an older tip can step forward without revealing", () => {
  const md = renderHelp(help, at, 0);
  assert.match(md, /<p>Нэг\.<\/p>/);
  assert.ok(md.includes(`${link(SHOW_TIP_COMMAND, ["abc", 1, 1, 12])}▶</a>`));
});

test("understood and all-seen states; fallback is labelled", () => {
  const understood = renderHelp({ ...help, understood: true }, at);
  assert.ok(!understood.includes(UNDERSTOOD_COMMAND));
  assert.match(understood, /✓ Ойлгосон/);

  const done = renderHelp({ ...help, hintsUsed: 3, source: "fallback", model: null }, at);
  assert.ok(!done.includes(REVEAL_COMMAND));
  assert.match(done, /Бүх зөвлөгөөг харлаа/);
  assert.match(done, /бэлэн тайлбар/);
});
