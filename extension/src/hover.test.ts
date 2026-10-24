import assert from "node:assert/strict";
import { test } from "node:test";
import { REVEAL_COMMAND, renderHelp } from "./hover.ts";

const help = {
  errorId: "abc",
  explanation: "Тайлбар.",
  hints: ["Нэг.", "Хоёр."],
  hintsUsed: 2,
  hintsTotal: 3,
  source: "gemma" as const,
  model: "gemma4:e2b",
};

test("link comes first, then the newest tip, each tip titled by its angle", () => {
  const md = renderHelp(help, { line: 4, character: 2 });
  const args = encodeURIComponent(JSON.stringify(["abc", 4, 2]));
  const link = md.indexOf(`(command:${REVEAL_COMMAND}?${args})`);
  const second = md.indexOf("**🧪 Яаж шалгах вэ** (2/3): Хоёр.");
  const first = md.indexOf("**🔍 Хаанаас хайх вэ** (1/3): Нэг.");
  assert.ok(link !== -1 && second !== -1 && first !== -1);
  assert.ok(link < second && second < first);
  assert.match(md, /Дараагийн зөвлөгөө \(3\/3\)/);
  assert.ok(!md.includes("Цаад санаа"));
  assert.match(md, /Gemma 4 \(gemma4:e2b\)/);
});

test("first link and the end state; fallback is labelled", () => {
  assert.match(
    renderHelp({ ...help, hints: [], hintsUsed: 0 }, { line: 0, character: 0 }),
    /Зөвлөгөө авах \(1\/3\)/,
  );
  const done = renderHelp(
    { ...help, hints: ["Нэг.", "Хоёр.", "Гурав."], hintsUsed: 3, source: "fallback", model: null },
    { line: 0, character: 0 },
  );
  assert.ok(!done.includes("command:"));
  assert.match(done, /🧠 Цаад санаа\*\* \(3\/3\): Гурав\./);
  assert.match(done, /бэлэн тайлбар/);
});
