import type { ErrorReport } from "./payload";

const REPORT_ERROR = `mutation ClassradarReportError($input: ClassradarErrorInput!) {
  classradarReportError(input: $input) { _id normalizedKey }
}`;

const HELP_FIELDS =
  "errorId message line title explanation hints hintsUsed hintsTotal understood source model";

const ERROR_HELP = `query ClassradarErrorHelp($errorId: String!, $studentEmail: String!) {
  classradarErrorHelp(errorId: $errorId, studentEmail: $studentEmail) { ${HELP_FIELDS} }
}`;

const REVEAL_HINT = `mutation ClassradarRevealHint($errorId: String!, $studentEmail: String!) {
  classradarRevealHint(errorId: $errorId, studentEmail: $studentEmail) { ${HELP_FIELDS} }
}`;

const MARK_UNDERSTOOD = `mutation ClassradarMarkUnderstood($errorId: String!, $studentEmail: String!) {
  classradarMarkUnderstood(errorId: $errorId, studentEmail: $studentEmail) { ${HELP_FIELDS} }
}`;

export type ErrorHelp = {
  errorId: string;
  message: string;
  /** 1-based. */
  line: number;
  title: string;
  explanation: string;
  hints: string[];
  hintsUsed: number;
  hintsTotal: number;
  understood: boolean;
  source: "gemma" | "fallback";
  model: string | null;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

type GraphQLResponse = {
  data?: Record<string, unknown> | null;
  errors?: { message: string }[];
};

const request = async <T>(
  gatewayUrl: string,
  query: string,
  variables: Record<string, unknown>,
  field: string,
  timeoutMs: number,
): Promise<Result<T>> => {
  try {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json()) as GraphQLResponse;
    const value = body.data?.[field];
    if (value) return { ok: true, value: value as T };
    return {
      ok: false,
      error: body.errors?.map((e) => e.message).join("; ") ?? `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export type SendResult = Result<{ _id: string; normalizedKey: string }>;

export const sendReport = (
  gatewayUrl: string,
  report: ErrorReport,
  timeoutMs = 5000,
): Promise<SendResult> =>
  request(gatewayUrl, REPORT_ERROR, { input: report }, "classradarReportError", timeoutMs);

// Gemma may be slow on a cold explanation; the server falls back on its own.
const HELP_TIMEOUT_MS = 15000;

export const fetchHelp = (gatewayUrl: string, errorId: string, studentEmail: string) =>
  request<ErrorHelp>(
    gatewayUrl,
    ERROR_HELP,
    { errorId, studentEmail },
    "classradarErrorHelp",
    HELP_TIMEOUT_MS,
  );

export const revealHint = (gatewayUrl: string, errorId: string, studentEmail: string) =>
  request<ErrorHelp>(
    gatewayUrl,
    REVEAL_HINT,
    { errorId, studentEmail },
    "classradarRevealHint",
    HELP_TIMEOUT_MS,
  );

export const markUnderstood = (gatewayUrl: string, errorId: string, studentEmail: string) =>
  request<ErrorHelp>(
    gatewayUrl,
    MARK_UNDERSTOOD,
    { errorId, studentEmail },
    "classradarMarkUnderstood",
    HELP_TIMEOUT_MS,
  );

const HEARTBEAT = `mutation ClassradarHeartbeat($studentEmail: String!, $classCode: String!, $seat: String, $hasError: Boolean!) {
  classradarHeartbeat(studentEmail: $studentEmail, classCode: $classCode, seat: $seat, hasError: $hasError)
}`;

/** Tells the seat map the student is here, and whether their code has an error. */
export const sendHeartbeat = (
  gatewayUrl: string,
  identity: { studentEmail: string; classCode: string; seat: string },
  hasError: boolean,
) =>
  request<boolean>(
    gatewayUrl,
    HEARTBEAT,
    { ...identity, seat: identity.seat || null, hasError },
    "classradarHeartbeat",
    5000,
  );
