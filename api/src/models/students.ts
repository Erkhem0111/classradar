import { type InferSchemaType, Schema, model } from "mongoose";

// One row per student and class: the seat map reads its live state from here.
const studentSchema = new Schema(
  {
    subdomain: { type: String, required: true },
    email: { type: String, required: true },
    classCode: { type: String, required: true },
    seat: { type: String, default: null },
    name: { type: String, default: null },
    // Last settled save from the extension; none today = absent.
    lastSeenAt: { type: Date, default: null },
    // When the current unfixed error appeared; null = the code is clean.
    errorSince: { type: Date, default: null },
  },
  { collection: "classradar_students", versionKey: false },
);

studentSchema.index({ subdomain: 1, classCode: 1, email: 1 }, { unique: true });

export type ClassradarStudentDoc = InferSchemaType<typeof studentSchema>;

export const ClassradarStudents = model("ClassradarStudent", studentSchema);
