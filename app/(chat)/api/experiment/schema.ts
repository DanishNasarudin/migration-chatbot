import { z } from "zod/v3";

export const SweepSchema = z.object({
  models: z.array(z.string()).min(1),
  promptModes: z.array(z.string()).min(1),
  unitTool: z.array(z.boolean()).min(1), // e.g. [false, true]
  driftCases: z.array(z.string().nullable()).min(1), // e.g. [null, "header_noise"]
});

export type Sweep = z.infer<typeof SweepSchema>;

export const CreateExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  datasetFileId: z.string().cuid(),
  specId: z.string().cuid(),
  matrix: SweepSchema,
});

export type CreateExperimentInput = z.infer<typeof CreateExperimentSchema>;

export const RunExperimentSchema = z.object({
  experimentId: z.string().cuid(),
  concurrency: z.number().int().positive().max(8).optional(), // defaults to 1
  dryRun: z.boolean().optional(), // if true, don't persist runs/trials
});

export type RunExperimentInput = z.infer<typeof RunExperimentSchema>;
