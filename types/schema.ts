import z from "zod/v3";

export const PredictedField = z.object({
  name: z.string().min(1),
  type: z
    .enum(["string", "number", "boolean", "date", "datetime"])
    .default("string"),
  nullable: z.boolean().default(true),
  unit: z.string().nullish(),
  enumVals: z.array(z.string()).optional().default([]),
  isPrimary: z.boolean().default(false),
});
export type PredictedField = z.infer<typeof PredictedField>;

export const PredictedSpec = z.object({
  title: z.string().optional(),
  version: z.string().default("predicted"),
  fields: z.array(PredictedField).min(1),
});
export type PredictedSpec = z.infer<typeof PredictedSpec>;

export type SchemaGenOptions = {
  modelId: string;
  datasetFileId: string;
  sampleRows?: number; // default 30
  promptMode: "validation_only" | "baseline" | "few_shot" | "schema_guided";
  domainHint?: string | null; // from Spec.domain when available
  driftCase?: string | null; // "header_noise"|"unit_change"|...
  stream?: boolean; // default true
  timeoutMs?: number; // default 30000
  fallbackToNonStreaming?: boolean; // default true
};
