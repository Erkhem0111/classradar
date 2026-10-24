import type { GraphQLResolverMap } from "@apollo/subgraph";
import { GraphQLError } from "graphql";
import { gql } from "graphql-tag";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { manifest } from "../config.ts";
import type { Context } from "../context.ts";
import { personalize, tokensAround } from "../explain/fallback.ts";
import { askGemma } from "../explain/gemma.ts";
import { explainError, explainNow, gemmaConfig } from "../explain/index.ts";
import { ClassradarExplanations } from "../models/explanations.ts";
import { interviewFeedback } from "../explain/interview.ts";
import { ClassradarStudents } from "../models/students.ts";
import {
  ClassradarErrors,
  ERROR_SOURCES,
  clampSnippet,
  normalizeErrorKey,
  startOfTodayUlaanbaatar,
  startOfWeekUlaanbaatar,
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

  type ClassradarInterviewFeedback {
    score: Int!
    good: String!
    improve: String!
    source: ClassradarExplanationSource!
  }

  "How the AI part is wired, for the settings page (teacher view)."
  type ClassradarAiStatus {
    configured: Boolean!
    model: String
    endpoint: String
    cachedExplanations: Int!
    errorsToday: Int!
    students: Int!
  }

  type ClassradarGemmaPing {
    ok: Boolean!
    ms: Int!
    title: String
    explanation: String
  }

  enum ClassradarLeaderboardRange {
    week
    all
  }

  type ClassradarLeaderboardRow {
    studentEmail: String!
    name: String
    seat: String
    "10 per fixed error, plus 15/10/5 when fixed with 0/1/2 tips."
    score: Int!
    fixed: Int!
    understood: Int!
  }

  type Query {
    classradarStatus: ClassradarStatus!
    classradarErrorHelp(errorId: String!, studentEmail: String!): ClassradarErrorHelp!
    "Today's (Ulaanbaatar time) three most repeated errors in a class."
    classradarTopErrors(classCode: String!): [ClassradarTopError!]!
    classradarAiStatus: ClassradarAiStatus!
    "Students ranked by errors they fixed themselves (teacher view)."
    classradarLeaderboard(
      classCode: String!
      range: ClassradarLeaderboardRange!
    ): [ClassradarLeaderboardRow!]!
    "Live seat map of a class (teacher view)."
    classradarSeats(classCode: String!): [ClassradarSeat!]!
  }

  type Mutation {
    classradarReportError(input: ClassradarErrorInput!): ClassradarError!
    "Reveals the next hint (at most 3) and records it in hintsUsed."
    classradarRevealHint(errorId: String!, studentEmail: String!): ClassradarErrorHelp!
    "Records that the student understood the error (first press wins)."
    classradarMarkUnderstood(errorId: String!, studentEmail: String!): ClassradarErrorHelp!
    "Asks Gemma 4 to explain a sample error right now (teacher view)."
    classradarPingGemma: ClassradarGemmaPing!
    "Gemma 4 feedback on one interview-practice answer (rule check when Gemma is down)."
    classradarInterviewFeedback(question: String!, answer: String!): ClassradarInterviewFeedback!
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

const interviewSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().max(4000),
});

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
    await explainNow(subdomain, error.normalizedKey, error.message),
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

    classradarLeaderboard: async (
      _parent,
      args: { classCode: string; range: "week" | "all" },
      context,
    ) => {
      requireUser(context);
      const { subdomain } = context;
      const classCode = args.classCode.trim();
      const since = args.range === "week" ? startOfWeekUlaanbaatar() : new Date(0);
      const rows = await ClassradarErrors.aggregate<{
        _id: string;
        score: number;
        fixed: number;
        understood: number;
      }>([
        { $match: { subdomain, classCode, fixedAt: { $ne: null, $gte: since } } },
        {
          $group: {
            _id: "$studentEmail",
            fixed: { $sum: 1 },
            understood: { $sum: { $cond: [{ $ne: ["$understoodAt", null] }, 1, 0] } },
            score: {
              $sum: {
                $add: [10, { $multiply: [5, { $max: [0, { $subtract: [3, "$hintsUsed"] }] }] }],
              },
            },
          },
        },
        { $sort: { score: -1, fixed: -1, _id: 1 } },
        { $limit: 50 },
      ]);
      const students = await ClassradarStudents.find({
        subdomain,
        classCode,
        email: { $in: rows.map((row) => row._id) },
      }).lean();
      const byEmail = new Map(students.map((student) => [student.email, student]));
      return rows.map((row) => ({
        studentEmail: row._id,
        name: byEmail.get(row._id)?.name ?? null,
        seat: byEmail.get(row._id)?.seat ?? null,
        score: row.score,
        fixed: row.fixed,
        understood: row.understood,
      }));
    },

    classradarAiStatus: async (_parent, _args, context) => {
      requireUser(context);
      const { subdomain } = context;
      const [cachedExplanations, errorsToday, students] = await Promise.all([
        ClassradarExplanations.countDocuments({ subdomain }),
        ClassradarErrors.countDocuments({
          subdomain,
          createdAt: { $gte: startOfTodayUlaanbaatar() },
        }),
        ClassradarStudents.countDocuments({ subdomain }),
      ]);
      return {
        configured: Boolean(gemmaConfig),
        model: gemmaConfig?.model ?? null,
        // Host only: never echo keys or paths back to the browser.
        endpoint: gemmaConfig ? new URL(gemmaConfig.url).host : null,
        cachedExplanations,
        errorsToday,
        students,
      };
    },

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
            ? (await explainNow(subdomain, error.normalizedKey, error.message)).title
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
            title: (await explainNow(context.subdomain, row.normalizedKey, row.sampleMessage))
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

    classradarPingGemma: async (_parent, _args, context) => {
      requireUser(context);
      if (!gemmaConfig) return { ok: false, ms: 0, title: null, explanation: null };
      const started = Date.now();
      const answer = await askGemma(gemmaConfig, "NameError: name 'totl' is not defined");
      return {
        ok: Boolean(answer),
        ms: Date.now() - started,
        title: answer?.title ?? null,
        explanation: answer?.explanation ?? null,
      };
    },

    // TODO(auth): anonymous like the other student calls; nothing is stored.
    classradarInterviewFeedback: async (_parent, args: unknown) => {
      const parsed = interviewSchema.safeParse(args);
      if (!parsed.success) throw badInput(parsed.error);
      return interviewFeedback(parsed.data.question, parsed.data.answer);
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
      // A clean save after errors: the student fixed them (leaderboard).
      if (!hasError) {
        await ClassradarErrors.updateMany(
          { subdomain, classCode, studentEmail, fixedAt: null },
          { $set: { fixedAt: now } },
        );
      }
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
