import type { GraphQLResolverMap } from "@apollo/subgraph";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { manifest } from "../config.ts";
import type { Context } from "../context.ts";
import { personalize, tokensAround } from "../explain/fallback.ts";
import { explainError } from "../explain/index.ts";
import { ClassradarStudents } from "../models/students.ts";
import {
  ClassradarErrors,
  ERROR_SOURCES,
  clampSnippet,
  normalizeErrorKey,
  startOfTodayUlaanbaatar,
} from "../models/errors.ts";

// Every type and operation is prefixed with the plugin name: the gateway
// composes all plugins into one supergraph, so names must be unique across it.
export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

  type ClassradarStatus {
    plugin: String!
    version: String!
    subdomain: String!
    userId: String
    userEmail: String
  }

  enum ClassradarErrorSource {
    diagnostic
    terminal
  }

  type ClassradarError {
    _id: String!
    studentEmail: String!
    classCode: String!
    seat: String
    file: String!
    line: Int!
    message: String!
    normalizedKey: String!
    snippet: String
    source: ClassradarErrorSource!
    hintsUsed: Int!
    createdAt: String!
  }

  type ClassradarTopError {
    normalizedKey: String!
    "A few words naming the problem."
    title: String!
    count: Int!
    sampleMessage: String!
  }

  input ClassradarErrorInput {
    studentEmail: String!
    classCode: String!
    seat: String
    file: String!
    line: Int!
    "0-based column of the error in its line."
    column: Int
    message: String!
    "The error line and at most one line either side; longer input is cut to 3 lines."
    snippet: String
    source: ClassradarErrorSource!
  }

  enum ClassradarExplanationSource {
    gemma
    fallback
  }

  "Mongolian help for one reported error. Tips are opened one at a time (hintsUsed)."
  type ClassradarErrorHelp {
    errorId: String!
    message: String!
    line: Int!
    "A few words naming the problem."
    title: String!
    explanation: String!
    "All tips, so the client can switch instantly; hintsUsed says how many the student opened."
    hints: [String!]!
    hintsUsed: Int!
    hintsTotal: Int!
    "The student pressed Ойлголоо (understood)."
    understood: Boolean!
    source: ClassradarExplanationSource!
    model: String
  }

  enum ClassradarSeatStatus {
    working
    error
    stuck
    absent
  }

  type ClassradarSeat {
    seat: String
    studentEmail: String!
    name: String
    status: ClassradarSeatStatus!
    "Minutes since the current error appeared (stuck after 5)."
    errorMinutes: Int
    "Today's latest error, when the student has one now."
    errorTitle: String
    errorMessage: String
    errorFile: String
    errorLine: Int
    hintsUsed: Int!
    understood: Boolean!
  }

  type Query {
    classradarStatus: ClassradarStatus!
    classradarErrorHelp(errorId: String!, studentEmail: String!): ClassradarErrorHelp!
    "Today's (Ulaanbaatar time) three most repeated errors in a class."
    classradarTopErrors(classCode: String!): [ClassradarTopError!]!
    "Live seat map of a class (teacher view)."
    classradarSeats(classCode: String!): [ClassradarSeat!]!
  }

  type Mutation {
    classradarReportError(input: ClassradarErrorInput!): ClassradarError!
    "Reveals the next hint (at most 3) and records it in hintsUsed."
    classradarRevealHint(errorId: String!, studentEmail: String!): ClassradarErrorHelp!
    "Records that the student understood the error (first press wins)."
    classradarMarkUnderstood(errorId: String!, studentEmail: String!): ClassradarErrorHelp!
    "Sent by the extension after each settled save: present, and with or without an error."
    classradarHeartbeat(
      studentEmail: String!
      classCode: String!
      seat: String
      hasError: Boolean!
    ): Boolean!
  }
`;

const errorInputSchema = z.object({
  studentEmail: z.string().trim().toLowerCase().email().max(200),
  classCode: z.string().trim().min(1).max(50),
  seat: z.string().trim().max(20).nullish(),
  file: z.string().trim().min(1).max(500),
  line: z.number().int().min(0).max(1_000_000),
  column: z.number().int().min(0).max(10_000).nullish(),
  message: z.string().trim().min(1).max(2000),
  snippet: z.string().max(1500).nullish(),
  source: z.enum(ERROR_SOURCES),
});

const badInput = (error: z.ZodError) =>
  new GraphQLError(
    error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
    {
      extensions: { code: "BAD_USER_INPUT" },
    },
  );

const requireUser = ({ user }: Context) => {
  if (!user) {
    throw new GraphQLError("Login required", { extensions: { code: "UNAUTHENTICATED" } });
  }
  return user;
};

const HINTS_TOTAL = 3;
const STUCK_MINUTES = 5;

const heartbeatSchema = z.object({
  studentEmail: z.string().trim().toLowerCase().email().max(200),
  classCode: z.string().trim().min(1).max(50),
  seat: z.string().trim().max(20).nullish(),
  hasError: z.boolean(),
});

const seatOrder = (seat: string | null | undefined) => {
  const number = Number(seat?.replace(/\D/g, ""));
  return Number.isFinite(number) && seat ? number : Number.MAX_SAFE_INTEGER;
};

type HelpArgs = { errorId: string; studentEmail: string };

// TODO(auth): students do not sign in to erxes yet, so the error id plus the
// reporting student's email stand in for ownership.
const ownedErrorFilter = ({ errorId, studentEmail }: HelpArgs, subdomain: string) => {
  if (!isValidObjectId(errorId)) {
    throw new GraphQLError("Error not found", { extensions: { code: "NOT_FOUND" } });
  }
  return { _id: errorId, subdomain, studentEmail: studentEmail.trim().toLowerCase() };
};

const toHelp = async (
  error: {
    _id: unknown;
    message: string;
    line: number;
    column?: number | null;
    snippet?: string | null;
    normalizedKey: string;
    hintsUsed: number;
    understoodAt?: Date | null;
  } | null,
  subdomain: string,
) => {
  if (!error) throw new GraphQLError("Error not found", { extensions: { code: "NOT_FOUND" } });
  const help = personalize(
    await explainError(subdomain, error.normalizedKey, error.message),
    error.message,
    tokensAround(error.snippet, error.line, error.column),
  );
  const hintsUsed = Math.min(error.hintsUsed, HINTS_TOTAL);
  return {
    errorId: String(error._id),
    message: error.message,
    line: error.line,
    title: help.title,
    explanation: help.explanation,
    hints: help.hints,
    hintsUsed,
    hintsTotal: HINTS_TOTAL,
    understood: Boolean(error.understoodAt),
    source: help.source,
    model: help.model,
  };
};

export const resolvers: GraphQLResolverMap<Context> = {
  Query: {
    classradarStatus: (_parent, _args, { subdomain, user }) => ({
      plugin: manifest.name,
      version: manifest.version,
      subdomain,
      userId: user?._id ?? null,
      userEmail: user?.email ?? null,
    }),

    classradarErrorHelp: async (_parent, args: HelpArgs, { subdomain }) =>
      toHelp(await ClassradarErrors.findOne(ownedErrorFilter(args, subdomain)).lean(), subdomain),

    classradarSeats: async (_parent, args: { classCode: string }, context) => {
      requireUser(context);
      const { subdomain } = context;
      const classCode = args.classCode.trim();
      const today = startOfTodayUlaanbaatar();
      const now = Date.now();
      const students = await ClassradarStudents.find({ subdomain, classCode }).limit(200).lean();
      const latest = await ClassradarErrors.aggregate<{
        _id: string;
        message: string;
        normalizedKey: string;
        file: string;
        line: number;
        hintsUsed: number;
        understoodAt: Date | null;
      }>([
        { $match: { subdomain, classCode, createdAt: { $gte: today } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$studentEmail",
            message: { $first: "$message" },
            normalizedKey: { $first: "$normalizedKey" },
            file: { $first: "$file" },
            line: { $first: "$line" },
            hintsUsed: { $first: "$hintsUsed" },
            understoodAt: { $first: "$understoodAt" },
          },
        },
      ]);
      const latestByEmail = new Map(latest.map((error) => [error._id, error]));

      const seats = await Promise.all(
        students.map(async (student) => {
          const present = Boolean(student.lastSeenAt && student.lastSeenAt >= today);
          const errorMinutes =
            present && student.errorSince
              ? Math.floor((now - student.errorSince.getTime()) / 60000)
              : null;
          const status = !present
            ? "absent"
            : errorMinutes === null
              ? "working"
              : errorMinutes >= STUCK_MINUTES
                ? "stuck"
                : "error";
          const error = errorMinutes === null ? undefined : latestByEmail.get(student.email);
          const title = error
            ? (await explainError(subdomain, error.normalizedKey, error.message)).title
            : null;
          return {
            seat: student.seat,
            studentEmail: student.email,
            name: student.name,
            status,
            errorMinutes,
            errorTitle: title,
            errorMessage: error?.message ?? null,
            errorFile: error?.file ?? null,
            errorLine: error?.line ?? null,
            hintsUsed: Math.min(error?.hintsUsed ?? 0, HINTS_TOTAL),
            understood: Boolean(error?.understoodAt),
          };
        }),
      );
      return seats.sort((a, b) => seatOrder(a.seat) - seatOrder(b.seat));
    },

    // Teacher view: requires a signed-in erxes user.
    classradarTopErrors: async (_parent, args: { classCode: string }, context) => {
      requireUser(context);
      return ClassradarErrors.aggregate<{
        normalizedKey: string;
        count: number;
        sampleMessage: string;
      }>([
        {
          $match: {
            subdomain: context.subdomain,
            classCode: args.classCode.trim(),
            createdAt: { $gte: startOfTodayUlaanbaatar() },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$normalizedKey",
            count: { $sum: 1 },
            sampleMessage: { $first: "$message" },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 3 },
        { $project: { _id: 0, normalizedKey: "$_id", count: 1, sampleMessage: 1 } },
      ]).then((rows) =>
        Promise.all(
          rows.map(async (row) => ({
            ...row,
            title: (await explainError(context.subdomain, row.normalizedKey, row.sampleMessage))
              .title,
          })),
        ),
      );
    },
  },

  Mutation: {
    // TODO(auth): the VS Code extension calls anonymously until the gateway
    // auth for students is decided; tenant still comes from the gateway host.
    classradarReportError: async (_parent, args: { input: unknown }, { subdomain }) => {
      const parsed = errorInputSchema.safeParse(args.input);
      if (!parsed.success) throw badInput(parsed.error);
      const input = parsed.data;

      const doc = await ClassradarErrors.create({
        ...input,
        subdomain,
        seat: input.seat || null,
        snippet: clampSnippet(input.snippet),
        normalizedKey: normalizeErrorKey(input.message),
      });
      // Warm the explanation cache so the student's hover is instant.
      void explainError(subdomain, doc.normalizedKey, doc.message).catch((error: unknown) =>
        console.error("classradar: explanation prefetch failed", error),
      );
      return { ...doc.toObject(), _id: doc._id.toString(), createdAt: doc.createdAt.toISOString() };
    },

    classradarRevealHint: async (_parent, args: HelpArgs, { subdomain }) => {
      const filter = ownedErrorFilter(args, subdomain);
      // Atomic: concurrent clicks cannot skip past or beyond the last hint.
      const updated = await ClassradarErrors.findOneAndUpdate(
        { ...filter, hintsUsed: { $lt: HINTS_TOTAL } },
        { $inc: { hintsUsed: 1 } },
        { new: true },
      ).lean();
      return toHelp(updated ?? (await ClassradarErrors.findOne(filter).lean()), subdomain);
    },

    // TODO(auth): anonymous like classradarReportError until student auth exists.
    classradarHeartbeat: async (_parent, args: unknown, { subdomain }) => {
      const parsed = heartbeatSchema.safeParse(args);
      if (!parsed.success) throw badInput(parsed.error);
      const { studentEmail, classCode, seat, hasError } = parsed.data;
      const now = new Date();
      const filter = { subdomain, classCode, email: studentEmail };
      await ClassradarStudents.updateOne(
        filter,
        { $set: { lastSeenAt: now, ...(seat ? { seat } : {}) } },
        { upsert: true },
      );
      // errorSince keeps the first moment of an unbroken run of errors.
      await ClassradarStudents.updateOne(hasError ? { ...filter, errorSince: null } : filter, {
        $set: { errorSince: hasError ? now : null },
      });
      return true;
    },

    classradarMarkUnderstood: async (_parent, args: HelpArgs, { subdomain }) => {
      const filter = ownedErrorFilter(args, subdomain);
      await ClassradarErrors.updateOne(
        { ...filter, understoodAt: null },
        { $set: { understoodAt: new Date() } },
      );
      return toHelp(await ClassradarErrors.findOne(filter).lean(), subdomain);
    },
  },
};
