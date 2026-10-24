import assert from "node:assert/strict";
import { test } from "node:test";
import { REVEAL_COMMAND, renderHelp } from "./hover.ts";

const help = {
  errorId: "abc",
  explanation: "Тайлбар.",
  hints: ["Нэг."],
  hintsUsed: 1,
  hintsTotal: 3,
  source: "gemma" as const,
  model: "gemma4:e2b",
};

test("shows revealed hints and a link to the next one at the error position", () => {
  const md = renderHelp(help, { line: 4, character: 2 });
  assert.match(md, /Сэжүүр 1\/3:\*\* Нэг\./);
  assert.ok(!md.includes("Сэжүүр 2/3:"));
  const args = encodeURIComponent(JSON.stringify(["abc", 4, 2]));
  assert.ok(md.includes(`(command:${REVEAL_COMMAND}?${args})`));
  assert.match(md, /Сэжүүр харах \(2\/3\)/);
  assert.match(md, /Gemma 4 \(gemma4:e2b\)/);
});

test("no link once all hints are shown; fallback is labelled", () => {
  const md = renderHelp(
    { ...help, hints: ["Нэг.", "Хоёр.", "Гурав."], hintsUsed: 3, source: "fallback", model: null },
    { line: 0, character: 0 },
  );
  assert.ok(!md.includes("command:"));
  assert.match(md, /бэлэн тайлбар/);
});
