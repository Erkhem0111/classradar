import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { fallbackExplanation } from "./fallback.ts";
import { askGemma, parseGemmaReply } from "./gemma.ts";

test("fallback matches common errors and has a generic default", () => {
  const generic = fallbackExplanation("Something odd happened");
  for (const message of [
    "NameError: name 'totl' is not defined",
    "Cannot find name 'itmes'.",
    "IndentationError: expected an indented block after 'for' statement on line 3",
    "SyntaxError: '(' was never closed",
    'TypeError: can only concatenate str (not "int") to str',
    "IndexError: list index out of range",
    "ZeroDivisionError: division by zero",
    "ModuleNotFoundError: No module named 'pandas'",
    "AttributeError: 'list' object has no attribute 'push'",
    "';' expected.",
  ]) {
    const result = fallbackExplanation(message);
    assert.notEqual(result, generic, message);
    assert.equal(result.hints.length, 3);
    assert.ok(result.title.length > 0, message);
  }
  assert.equal(generic.hints.length, 3);
});

const good = {
  title: "Нэр танигдсангүй",
  explanation: "Компьютер энэ нэрийг танихгүй байна.",
  hints: ["Нэрийг хаана үүсгэснээ хай.", "Үсгүүдийг харьцуул.", "Хоёр мөрийн нэрийг тулгаж үз."],
};

test("parses a Gemma reply, even wrapped in prose", () => {
  assert.deepEqual(parseGemmaReply(JSON.stringify(good)), good);
  assert.deepEqual(parseGemmaReply("Энэ байна:\n```json\n" + JSON.stringify(good) + "\n```"), good);
});

test("rejects replies with code, wrong shape or no JSON", () => {
  const leaked = { ...good, hints: [good.hints[0], "Ингэж бич: print(total)", good.hints[2]] };
  assert.equal(parseGemmaReply(JSON.stringify(leaked)), null);
  assert.equal(parseGemmaReply(JSON.stringify({ ...good, hints: good.hints.slice(0, 2) })), null);
  assert.equal(parseGemmaReply("Уучлаарай, мэдэхгүй."), null);
});

test("askGemma talks OpenAI-compatible chat and falls back on timeout", async () => {
  let delayMs = 0;
  let seenBody = "";
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      seenBody = body;
      setTimeout(() => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }] }));
      }, delayMs);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}/v1`;
  try {
    const config = { url, model: "gemma4:e2b", timeoutMs: 500 };
    assert.deepEqual(await askGemma(config, "NameError: name 'x' is not defined"), good);
    const sent = JSON.parse(seenBody) as { model: string; messages: { content: string }[] };
    assert.equal(sent.model, "gemma4:e2b");
    assert.match(sent.messages[1]?.content ?? "", /NameError/);
    delayMs = 1000;
    assert.equal(await askGemma(config, "NameError"), null);
    assert.equal(await askGemma({ ...config, url: "http://localhost:1/v1" }, "NameError"), null);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("tips name the student's exact name or gap, never the compiler's guess", async () => {
  const { personalize, tokensAround } = await import("./fallback.ts");
  const missingDot = "';' expected.";
  const gap = personalize(
    fallbackExplanation(missingDot),
    missingDot,
    tokensAround("const total = 0;\nconsole log(total);\n", 2, 8),
  );
  assert.match(gap.hints[0], /`console` ба `log` хоёрын хооронд/);
  assert.ok(![gap.explanation, ...gap.hints].some((text) => text.includes("`;`")));

  const typo = "Cannot find name 'totl'. Did you mean 'total'?";
  const named = personalize(fallbackExplanation(typo), typo);
  assert.match(named.explanation, /`totl`/);
  assert.ok(![named.explanation, ...named.hints].some((text) => text.includes("total")));

  const attr = "AttributeError: 'list' object has no attribute 'push'";
  assert.match(personalize(fallbackExplanation(attr), attr).explanation, /`push`/);
});

test("askGemma retries with the prompt inline when the API rejects system/JSON mode", async () => {
  const bodies: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      bodies.push(body);
      if (body.includes('"role":"system"')) {
        res.statusCode = 400;
        res.end("{}");
        return;
      }
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(good) } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}/v1`;
  try {
    const answer = await askGemma({ url, model: "gemma-4", timeoutMs: 2000 }, "NameError");
    assert.deepEqual(answer, good);
    assert.equal(bodies.length, 2);
    assert.ok(!bodies[1]?.includes("response_format"));
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("drops Gemma 4's <thought> block and rejects replies that leak the fix", () => {
  const thought = `<thought>Format: {"title": "...", "explanation": "...", "hints": ["..."]}</thought>\n`;
  assert.deepEqual(parseGemmaReply(thought + JSON.stringify(good)), good);
  const leaky = {
    ...good,
    hints: [good.hints[0], "Магадгүй чи total гэж бичих гэсэн үү?", good.hints[2]],
  };
  assert.equal(
    parseGemmaReply(JSON.stringify(leaky), "Cannot find name 'totl'. Did you mean 'total'?"),
    null,
  );
});
