// Pure logic, no `vscode` import, so it can be unit tested with plain Node.

export type ErrorSource = "diagnostic" | "terminal";

export type StudentIdentity = {
  studentEmail: string;
  classCode: string;
  seat: string;
};

export type ErrorReport = StudentIdentity & {
  file: string;
  /** 1-based, as shown in the editor. */
  line: number;
  /** 0-based column, so tips can name the exact gap. */
  column: number | null;
  message: string;
  snippet: string | null;
  source: ErrorSource;
};

/** One editor error, reduced to what the plugin may see. */
export type CapturedError = {
  file: string;
  /** 0-based, as VS Code reports it. */
  line: number;
  /** 0-based. */
  character?: number;
  message: string;
};

const MAX_SNIPPET_LINE = 200;

/**
 * The error line and at most one line either side. Never more: the student's
 * full code must not leave their machine.
 */
export const buildSnippet = (lines: readonly string[], line: number) => {
  if (line < 0 || line >= lines.length) return null;
  const snippet = lines
    .slice(Math.max(0, line - 1), line + 2)
    .map((text) => text.slice(0, MAX_SNIPPET_LINE))
    .join("\n");
  return snippet.trim() ? snippet : null;
};

export const buildReport = (
  identity: StudentIdentity,
  error: CapturedError,
  lines: readonly string[],
): ErrorReport => ({
  ...identity,
  file: error.file,
  line: error.line + 1,
  column: error.character ?? null,
  // Some language servers append multi-line detail; the first line is the error.
  message: (error.message.split(/\r?\n/)[0] ?? error.message).trim().slice(0, 2000),
  snippet: buildSnippet(lines, error.line),
  source: "diagnostic",
});

/**
 * The error worth showing: the first one in the file. Later errors are often
 * knock-on effects of it (one missing bracket can produce several), and
 * beginners are taught to fix the first error first.
 */
export const pickPrimaryError = <T extends { line: number; character: number }>(
  errors: readonly T[],
): T | undefined => [...errors].sort((a, b) => a.line - b.line || a.character - b.character)[0];

export const reportKey = (report: Pick<ErrorReport, "file" | "line" | "message">) =>
  `${report.file}\u0000${report.line}\u0000${report.message}`;

/**
 * Remembers what was already sent per file, so saving the same broken file
 * again does not report the same error twice. Errors that disappear are
 * forgotten, so reintroducing one later reports it again.
 */
export class SentTracker {
  private readonly sent = new Map<string, Set<string>>();

  /** Returns the reports not sent yet and records the file's current errors. */
  diff(file: string, reports: readonly ErrorReport[]) {
    const previous = this.sent.get(file) ?? new Set<string>();
    const current = new Set(reports.map(reportKey));
    this.sent.set(file, current);
    return reports.filter((report) => !previous.has(reportKey(report)));
  }

  /** Forget a report whose send failed, so the next save retries it. */
  forget(report: ErrorReport) {
    this.sent.get(report.file)?.delete(reportKey(report));
  }
}
