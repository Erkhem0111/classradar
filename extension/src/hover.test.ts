import assert from "node:assert/strict";
import { test } from "node:test";
import { REVEAL_COMMAND, SHOW_TIP_COMMAND, renderHelp } from "./hover.ts";

const help = {
  errorId: "abc",
  explanation: "Тайлбар.",
  hints: ["Нэг.", "Хоёр."],
  hintsUsed: 2,
  hintsTotal: 3,
  source: "gemma" as const,
  model: "gemma4:e2b",
};
const at = { line: 4, character: 2 };
const link = (command: string, args: unknown[]) =>
  `(command:${command}?${encodeURIComponent(JSON.stringify(args))})`;

test("shows only the newest tip by default, with back and reveal arrows", () => {
  const md = renderHelp(help, at);
  assert.match(md, /🧪 Яаж шалгах вэ\*\* \(2\/3\)\n\nХоёр\./);
  assert.ok(!md.includes("Нэг."));
  assert.ok(md.includes(`◀ Өмнөх]${link(SHOW_TIP_COMMAND, ["abc", 0, 4, 2])}`));
  assert.ok(md.includes(`Шинэ зөвлөгөө ▶ (3/3)]${link(REVEAL_COMMAND, ["abc", 4, 2])}`));
  assert.match(md, /Gemma 4 \(gemma4:e2b\)/);
});

test("an older tip navigates forward without revealing", () => {
  const md = renderHelp(help, at, 0);
  assert.match(md, /🔍 Хаанаас хайх вэ\*\* \(1\/3\)\n\nНэг\./);
  assert.ok(!md.includes("Хоёр."));
  assert.ok(!md.includes("◀"));
  assert.ok(md.includes(`Дараагийн ▶]${link(SHOW_TIP_COMMAND, ["abc", 1, 4, 2])}`));
  assert.ok(!md.includes(REVEAL_COMMAND));
});

test("no tips yet, and all tips seen; fallback is labelled", () => {
  const none = renderHelp({ ...help, hints: [], hintsUsed: 0 }, at);
  assert.match(none, /💡 Зөвлөгөө авах \(1\/3\)/);
  assert.ok(!none.includes("◀"));

  const done = renderHelp(
    { ...help, hints: ["Нэг.", "Хоёр.", "Гурав."], hintsUsed: 3, source: "fallback", model: null },
    at,
  );
  assert.match(done, /🧠 Цаад санаа\*\* \(3\/3\)\n\nГурав\./);
  assert.ok(!done.includes(REVEAL_COMMAND));
  assert.match(done, /Бүх зөвлөгөөг харлаа/);
  assert.match(done, /бэлэн тайлбар/);
});
