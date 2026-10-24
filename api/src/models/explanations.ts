import { type InferSchemaType, Schema, model } from "mongoose";

// One Gemma explanation per error kind (normalizedKey) and tenant: the whole
// class shares it, so a slow model is called once per kind, not per student.
const explanationSchema = new Schema(
  {
    subdomain: { type: String, required: true },
    normalizedKey: { type: String, required: true },
    title: { type: String, default: "" },
    explanation: { type: String, required: true },
    hints: { type: [String], required: true },
    model: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "classradar_explanations", versionKey: false },
);

explanationSchema.index({ subdomain: 1, normalizedKey: 1 }, { unique: true });

export type ClassradarExplanationDoc = InferSchemaType<typeof explanationSchema>;

export const ClassradarExplanations = model("ClassradarExplanation", explanationSchema);
