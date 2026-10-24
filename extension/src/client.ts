import type { ErrorReport } from "./payload";

const REPORT_ERROR = `mutation ClassradarReportError($input: ClassradarErrorInput!) {
  classradarReportError(input: $input) { _id normalizedKey }
}`;

type GraphQLResponse = {
  data?: { classradarReportError?: { _id: string; normalizedKey: string } | null } | null;
  errors?: { message: string }[];
};

export type SendResult =
  | { ok: true; id: string; normalizedKey: string }
  | { ok: false; error: string };

export const sendReport = async (
  gatewayUrl: string,
  report: ErrorReport,
  timeoutMs = 5000,
): Promise<SendResult> => {
  try {
    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: REPORT_ERROR, variables: { input: report } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json()) as GraphQLResponse;
    const saved = body.data?.classradarReportError;
    if (saved) return { ok: true, id: saved._id, normalizedKey: saved.normalizedKey };
    return {
      ok: false,
      error: body.errors?.map((e) => e.message).join("; ") ?? `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};
