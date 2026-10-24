import { type InferSchemaType, Schema, model } from "mongoose";

export const ERROR_SOURCES = ["diagnostic", "terminal"] as const;

const errorSchema = new Schema(
  {
    // Tenant the error belongs to; every query filters by it.
    subdomain: { type: String, required: true },
    studentEmail: { type: String, required: true },
    classCode: { type: String, required: true },
    seat: { type: String, default: null },
    file: { type: String, required: true },
    line: { type: Number, required: true },
    // 0-based column of the error in that line, when the editor knows it.
    column: { type: Number, default: null },
    message: { type: String, required: true },
    normalizedKey: { type: String, required: true },
    // At most the error line and one line either side, never the whole file.
    snippet: { type: String, default: null },
    source: { type: String, enum: ERROR_SOURCES, required: true },
    hintsUsed: { type: Number, default: 0 },
    // Set when the student presses "Ойлголоо" (understood) in the hover.
    understoodAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "classradar_errors", versionKey: false },
);

errorSchema.index({ subdomain: 1, classCode: 1, createdAt: -1 });

export type ClassradarErrorDoc = InferSchemaType<typeof errorSchema>;

export const ClassradarErrors = model("ClassradarError", errorSchema);

/**
 * Groups the same mistake across students: drops quoted identifiers, numbers
 * and line/column positions so `Cannot find name 'x'` and `'y'` share a key.
 */
export const normalizeErrorKey = (message: string) =>
  message
    .toLowerCase()
    .replace(/(['"`‘’“”])[^'"`‘’“”\n]*\1|[‘“][^’”\n]*[’”]/g, "<id>")
    .replace(/\b(line|ln|col|column)\s*\d+/g, "$1 <n>")
    .replace(/(:\d+)+/g, ":<n>")
    .replace(/\b\d+(\.\d+)?\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();

/** Keeps only the first three lines of a snippet. */
export const clampSnippet = (snippet: string | null | undefined) =>
  snippet ? snippet.split(/\r?\n/).slice(0, 3).join("\n") : null;

const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Start of the current day in Ulaanbaatar (UTC+8). */
export const startOfTodayUlaanbaatar = (now = new Date()) => {
  const local = new Date(now.getTime() + UB_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - UB_OFFSET_MS);
};
