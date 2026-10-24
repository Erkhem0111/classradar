import assert from "node:assert/strict";
import { test } from "node:test";
import { SentTracker, buildReport, buildSnippet, pickPrimaryError } from "./payload.ts";

const identity = { studentEmail: "bat@school.mn", classCode: "10A", seat: "A1" };
const lines = ["a = 1", "b = 2", "print(c)", "d = 4", "e = 5"];

test("snippet is the error line plus one line either side", () => {
  assert.equal(buildSnippet(lines, 2), "b = 2\nprint(c)\nd = 4");
  assert.equal(buildSnippet(lines, 0), "a = 1\nb = 2");
  assert.equal(buildSnippet(lines, 4), "d = 4\ne = 5");
  assert.equal(buildSnippet(lines, 9), null);
});

test("report uses 1-based lines and the first message line", () => {
  const report = buildReport(
    identity,
    { file: "main.py", line: 2, message: '"c" is not defined\n  more detail' },
    lines,
  );
  assert.equal(report.line, 3);
  assert.equal(report.message, '"c" is not defined');
  assert.equal(report.source, "diagnostic");
  assert.equal(report.snippet?.split("\n").length, 3);
});

test("tracker sends each error once and retries forgotten ones", () => {
  const tracker = new SentTracker();
  const a = buildReport(identity, { file: "main.py", line: 2, message: "x" }, lines);
  const b = buildReport(identity, { file: "main.py", line: 3, message: "y" }, lines);
  assert.deepEqual(tracker.diff("main.py", [a]), [a]);
  assert.deepEqual(tracker.diff("main.py", [a, b]), [b]);
  tracker.forget(b);
  assert.deepEqual(tracker.diff("main.py", [a, b]), [b]);
  // Fixed then reintroduced: reported again.
  assert.deepEqual(tracker.diff("main.py", []), []);
  assert.deepEqual(tracker.diff("main.py", [a]), [a]);
});

test("primary error is the first one in the file", () => {
  const errors = [
    { line: 7, character: 0, message: "c" },
    { line: 2, character: 9, message: "b" },
    { line: 2, character: 3, message: "a" },
  ];
  assert.equal(pickPrimaryError(errors)?.message, "a");
  assert.equal(pickPrimaryError([]), undefined);
});
