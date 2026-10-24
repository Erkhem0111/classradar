// Demo data for one class: a 24-seat roster whose errors, heartbeats and tips
// go through the real gateway mutations, so normalizing, grouping and seat
// status run exactly as in class. Only "stuck" seats are mocked by moving
// their error start back in time.
// Usage: pnpm --filter classradar_api seed:demo [--reset] [--class 10A]
import { connectMongo, disconnectMongo } from "./db.ts";
import { ClassradarErrors } from "./models/errors.ts";
import { ClassradarStudents } from "./models/students.ts";

const argValue = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const classCode = argValue("--class") ?? "10A";
const gatewayUrl = argValue("--gateway") ?? "http://localhost:4000/graphql";
// The gateway derives the tenant from the host; seed rows must match it.
const subdomain = "localhost";

type MockError = { file: string; line: number; message: string; snippet: string };

// Same mistake with different names on purpose: they must share one normalizedKey.
const nameError = (name: string, line: number): MockError => ({
  file: "main.py",
  line,
  message: `NameError: name '${name}' is not defined`,
  snippet: `total = 0\nprint(${name})\n`,
});
const unclosed = (line: number): MockError => ({
  file: "main.py",
  line,
  message: "SyntaxError: '(' was never closed",
  snippet: `name = input("Нэр: "\nprint(name)\n`,
});
const typeError = (line: number): MockError => ({
  file: "main.py",
  line,
  message: `TypeError: can only concatenate str (not "int") to str`,
  snippet: `age = 15\nprint("Нас: " + age)\n`,
});
const indentError = (line: number): MockError => ({
  file: "main.py",
  line,
  message: `IndentationError: expected an indented block after 'for' statement on line ${line - 1}`,
  snippet: `for i in range(5):\nprint(i)\n`,
});

type Plan =
  | { kind: "working" }
  | { kind: "absent" }
  | { kind: "error" | "stuck"; error: MockError; tips?: number; understood?: boolean };

// Seat С12 is left for the live demo student (the extension's default seat).
const roster: [seat: string, name: string, email: string, plan: Plan][] = [
  ["С1", "Бат-Эрдэнэ", "bat@school.mn", { kind: "working" }],
  ["С2", "Сараа", "saraa@school.mn", { kind: "working" }],
  ["С3", "Тэмүүжин", "temuujin@school.mn", { kind: "error", error: nameError("summ", 3), tips: 1 }],
  ["С4", "Номин", "nomin@school.mn", { kind: "working" }],
  ["С5", "Хулан", "khulan@school.mn", { kind: "working" }],
  ["С6", "Эрдэнэ", "erdene@school.mn", { kind: "absent" }],
  ["С7", "Ану", "anu@school.mn", { kind: "working" }],
  ["С8", "Түгөлдөр", "tuguldur@school.mn", { kind: "stuck", error: unclosed(3), tips: 3 }],
  ["С9", "Марал", "maral@school.mn", { kind: "working" }],
  ["С10", "Билгүүн", "bilguun@school.mn", { kind: "working" }],
  ["С11", "Заяа", "zaya@school.mn", { kind: "stuck", error: nameError("reslt", 8), tips: 2 }],
  ["С12", "Демо сурагч", "demo.student@classradar.mn", { kind: "absent" }],
  ["С13", "Мөнх", "munkh@school.mn", { kind: "working" }],
  ["С14", "Оюу", "oyu@school.mn", { kind: "working" }],
  ["С15", "Ганболд", "ganbold@school.mn", { kind: "working" }],
  [
    "С16",
    "Энхжин",
    "enkhjin@school.mn",
    { kind: "error", error: typeError(6), tips: 1, understood: true },
  ],
  ["С17", "Төгс", "tugs@school.mn", { kind: "working" }],
  ["С18", "Солонго", "solongo@school.mn", { kind: "working" }],
  ["С19", "Батбаяр", "batbayar@school.mn", { kind: "absent" }],
  ["С20", "Уянга", "uyanga@school.mn", { kind: "working" }],
  ["С21", "Даваа", "davaa@school.mn", { kind: "working" }],
  ["С22", "Ариунаа", "ariunaa@school.mn", { kind: "working" }],
  ["С23", "Лхагва", "lkhagva@school.mn", { kind: "stuck", error: indentError(5), tips: 1 }],
  ["С24", "Цэцгээ", "tsetsgee@school.mn", { kind: "working" }],
];

// Earlier errors in the day that were since fixed (the student's next clean
// save marks them fixed), with the tips they needed: fewer tips, more points.
const fixedEarlier: [email: string, error: MockError, tips: number][] = [
  ["bat@school.mn", nameError("totl", 4), 0],
  ["bat@school.mn", typeError(9), 1],
  ["bat@school.mn", unclosed(3), 0],
  ["saraa@school.mn", nameError("cnt", 12), 1],
  ["saraa@school.mn", indentError(6), 0],
  ["nomin@school.mn", unclosed(2), 0],
  ["nomin@school.mn", nameError("sum1", 5), 0],
  ["nomin@school.mn", typeError(7), 0],
  ["nomin@school.mn", indentError(3), 1],
  ["maral@school.mn", nameError("Total", 2), 2],
  ["oyu@school.mn", unclosed(1), 3],
  ["munkh@school.mn", typeError(4), 1],
  ["munkh@school.mn", nameError("lst", 8), 2],
  ["khulan@school.mn", indentError(5), 0],
  ["khulan@school.mn", unclosed(4), 1],
  ["anu@school.mn", typeError(2), 2],
  ["bilguun@school.mn", nameError("itmes", 2), 0],
  ["tsetsgee@school.mn", unclosed(6), 1],
];

const call = async <T>(query: string, variables: Record<string, unknown>, field: string) => {
  const response = await fetch(gatewayUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as {
    data?: Record<string, T> | null;
    errors?: { message: string }[];
  };
  const value = body.data?.[field];
  if (value === undefined || value === null) {
    throw new Error(`${field}: ${body.errors?.map((e) => e.message).join("; ") ?? "no data"}`);
  }
  return value;
};

const report = (studentEmail: string, seat: string, error: MockError) =>
  call<{ _id: string }>(
    `mutation SeedReportError($input: ClassradarErrorInput!) {
      classradarReportError(input: $input) { _id }
    }`,
    { input: { ...error, studentEmail, classCode, seat, source: "diagnostic" } },
    "classradarReportError",
  );

const heartbeat = (studentEmail: string, seat: string, hasError: boolean) =>
  call<boolean>(
    `mutation SeedHeartbeat($studentEmail: String!, $classCode: String!, $seat: String, $hasError: Boolean!) {
      classradarHeartbeat(studentEmail: $studentEmail, classCode: $classCode, seat: $seat, hasError: $hasError)
    }`,
    { studentEmail, classCode, seat, hasError },
    "classradarHeartbeat",
  );

const helpMutation = (field: string, errorId: string, studentEmail: string) =>
  call<{ hintsUsed: number }>(
    `mutation SeedHelp($errorId: String!, $studentEmail: String!) {
      ${field}(errorId: $errorId, studentEmail: $studentEmail) { hintsUsed }
    }`,
    { errorId, studentEmail },
    field,
  );

await connectMongo();
if (process.argv.includes("--reset")) {
  const errors = await ClassradarErrors.deleteMany({ classCode });
  const students = await ClassradarStudents.deleteMany({ classCode });
  console.log(
    `Reset ${classCode}: ${errors.deletedCount} errors, ${students.deletedCount} students`,
  );
}

for (const [seat, name, email] of roster) {
  await ClassradarStudents.updateOne(
    { subdomain, classCode, email },
    { $set: { seat, name } },
    { upsert: true },
  );
}

const seatOf = new Map(roster.map(([seat, , email]) => [email, seat]));
let sent = 0;
for (const [email, error, tips] of fixedEarlier) {
  const { _id } = await report(email, seatOf.get(email) ?? "", error);
  for (let tip = 0; tip < tips; tip += 1) await helpMutation("classradarRevealHint", _id, email);
  sent += 1;
}

for (const [seat, , email, plan] of roster) {
  if (plan.kind === "absent") continue;
  if (plan.kind === "working") {
    await heartbeat(email, seat, false);
    continue;
  }
  const { _id } = await report(email, seat, plan.error);
  sent += 1;
  await heartbeat(email, seat, true);
  for (let tip = 0; tip < (plan.tips ?? 0); tip += 1) {
    await helpMutation("classradarRevealHint", _id, email);
  }
  if (plan.understood) await helpMutation("classradarMarkUnderstood", _id, email);
  if (plan.kind === "stuck") {
    const minutesAgo = 6 + Math.floor(Math.random() * 8);
    await ClassradarStudents.updateOne(
      { subdomain, classCode, email },
      { $set: { errorSince: new Date(Date.now() - minutesAgo * 60000) } },
    );
  }
}

await disconnectMongo();
console.log(`Seeded class ${classCode}: ${roster.length} seats, ${sent} errors`);
