// Demo data: mock students of one class report realistic errors through the
// real gateway mutation, so normalizing and grouping run exactly as in class.
// Usage: pnpm --filter classradar_api seed:demo [--reset] [--class 10A]
import { connectMongo, disconnectMongo } from "./db.ts";
import { ClassradarErrors } from "./models/errors.ts";

const argValue = (flag: string) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
};

const classCode = argValue("--class") ?? "10A";
const gatewayUrl = argValue("--gateway") ?? "http://localhost:4000/graphql";

const students = [
  ["bat", "A1"],
  ["saraa", "A2"],
  ["temuujin", "A3"],
  ["nomin", "A4"],
  ["khulan", "A5"],
  ["erdene", "B1"],
  ["anu", "B2"],
  ["tuguldur", "B3"],
  ["maral", "B4"],
  ["bilguun", "B5"],
  ["zaya", "C1"],
  ["munkh", "C2"],
  ["oyu", "C3"],
  ["ganbold", "C4"],
] as const;

type MockError = { file: string; line: number; message: string; snippet: string };

// Same mistake with different names on purpose: they must share one normalizedKey.
const nameError = (name: string, line: number): MockError => ({
  file: "main.py",
  line,
  message: `NameError: name '${name}' is not defined`,
  snippet: `total = 0\nprint(${name})\n`,
});
const indentError = (line: number): MockError => ({
  file: "main.py",
  line,
  message: `IndentationError: expected an indented block after 'for' statement on line ${line - 1}`,
  snippet: `for i in range(5):\nprint(i)\n`,
});
const typeError = (line: number): MockError => ({
  file: "main.py",
  line,
  message: `TypeError: can only concatenate str (not "int") to str`,
  snippet: `age = 15\nprint("Нас: " + age)\n`,
});
const syntaxError = (line: number): MockError => ({
  file: "main.py",
  line,
  message: "SyntaxError: '(' was never closed",
  snippet: `name = input("Нэр: "\nprint(name)\n`,
});
const tsError = (name: string, line: number): MockError => ({
  file: "src/index.ts",
  line,
  message: `Cannot find name '${name}'.`,
  snippet: `const items = [1, 2, 3];\nconsole.log(${name}.length);\n`,
});

// Seats left out (C5…) stay "absent" on the board.
const plan: Record<string, MockError[]> = {
  bat: [nameError("totl", 4), indentError(7)],
  saraa: [nameError("cnt", 12)],
  temuujin: [nameError("summ", 3), typeError(9)],
  nomin: [indentError(5)],
  khulan: [nameError("reslt", 8)],
  erdene: [typeError(6), nameError("lenght", 10)],
  anu: [],
  tuguldur: [indentError(3), syntaxError(1)],
  maral: [nameError("Total", 2)],
  bilguun: [tsError("itmes", 2)],
  zaya: [],
  munkh: [typeError(4)],
  oyu: [syntaxError(2)],
  ganbold: [nameError("prnt", 1)],
};

const REPORT_ERROR = `mutation SeedReportError($input: ClassradarErrorInput!) {
  classradarReportError(input: $input) { normalizedKey }
}`;

if (process.argv.includes("--reset")) {
  await connectMongo();
  const { deletedCount } = await ClassradarErrors.deleteMany({ classCode });
  await disconnectMongo();
  console.log(`Reset: removed ${deletedCount} errors of class ${classCode}`);
}

let sent = 0;
for (const [name, seat] of students) {
  for (const error of plan[name] ?? []) {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: REPORT_ERROR,
        variables: {
          input: {
            ...error,
            studentEmail: `${name}@school.mn`,
            classCode,
            seat,
            source: "diagnostic",
          },
        },
      }),
    });
    const body = (await response.json()) as { errors?: { message: string }[] };
    if (body.errors) throw new Error(`${name}: ${body.errors.map((e) => e.message).join("; ")}`);
    sent += 1;
  }
}
console.log(`Seeded ${sent} errors from ${students.length} mock students into class ${classCode}`);
