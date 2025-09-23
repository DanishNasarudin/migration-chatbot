"use server";
import { Sweep } from "@/app/(chat)/api/experiment/schema";
import { MODEL_REGISTRY } from "@/lib/ai/models";
import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { runValidation } from "@/services/validate-run";
import { SpecDoc } from "@/types/spec";
import { revalidatePath } from "next/cache";

export type RunSummary = {
  experimentId: string;
  combinations: number;
  trialsCreated: number;
  validationRunsCreated: number;
  errors: Array<{ combo: Record<string, unknown>; error: string }>;
};

export async function runExperiment(
  experimentId: string,
  opts?: { concurrency?: number; dryRun?: boolean }
): Promise<RunSummary> {
  const exp = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: { datasetFile: true, spec: true },
  });
  if (!exp) throw new ChatSDKError("not_found:api", "Experiment not found");
  if (!exp.spec?.raw)
    throw new ChatSDKError("bad_request:api", "Spec.raw missing");

  const matrix = exp.matrix as Sweep;
  const combos = cartesian(matrix);

  let trialsCreated = 0;
  let validationRunsCreated = 0;
  const errors: RunSummary["errors"] = [];

  const concurrency = Math.max(1, Math.min(8, opts?.concurrency ?? 1));

  for (let i = 0; i < combos.length; i += concurrency) {
    const batch = combos.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map(async (c) => {
        try {
          const latestProfile = await prisma.datasetProfile.findFirst({
            where: { datasetFileId: exp.datasetFileId },
            orderBy: { createdAt: "desc" },
          });

          const specDoc = exp.spec!.raw as SpecDoc;

          const validation = await runValidation(exp.datasetFileId, specDoc, {
            unitTool: c.unitTool,
            profile: latestProfile
              ? {
                  rowCount: (latestProfile as any).rowCount ?? 0,
                  columns: (latestProfile as any).columns ?? [],
                }
              : undefined,
          });

          if (opts?.dryRun) return { validation, runId: null, trialId: null };

          const run = await prisma.validationRun.create({
            data: {
              datasetFileId: exp.datasetFileId,
              specId: exp.specId,
              modelId: c.modelId,
              promptMode: c.promptMode,
              unitTool: c.unitTool,
              driftCase: c.driftCase ?? null,
              passed: validation.passed,
              metrics: validation.metrics as any,
              issues: { create: validation.issues },
            },
          });
          validationRunsCreated++;

          await prisma.trial.create({
            data: {
              experimentId: exp.id,
              modelId: c.modelId,
              promptMode: c.promptMode,
              unitTool: c.unitTool,
              driftCase: c.driftCase ?? null,
              validationRunId: run.id,
              result: validation.metrics as any,
            },
          });
          trialsCreated++;
        } catch (err: any) {
          // Keep the run going; record structured error
          const msg =
            err instanceof ChatSDKError
              ? `${err.type}:${err.surface} ${err.message}`
              : String(err?.message ?? err);
          errors.push({ combo: c as any, error: msg });
        }
      })
    );
    void results;
  }

  return {
    experimentId,
    combinations: combos.length,
    trialsCreated,
    validationRunsCreated,
    errors,
  };
}

function cartesian(matrix: Sweep) {
  const out: Array<{
    modelId: string;
    promptMode: string;
    unitTool: boolean;
    driftCase: string | null;
  }> = [];
  for (const modelId of matrix.models) {
    for (const promptMode of matrix.promptModes) {
      for (const unitTool of matrix.unitTool) {
        for (const driftCase of matrix.driftCases) {
          out.push({
            modelId,
            promptMode,
            unitTool,
            driftCase: driftCase ?? null,
          });
        }
      }
    }
  }
  return out;
}
export async function listChoices() {
  const [files, specs] = await Promise.all([
    prisma.datasetFile.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, createdAt: true },
    }),
    prisma.spec.findMany({
      orderBy: [{ name: "asc" }, { version: "desc" }],
      select: { id: true, name: true, version: true, raw: true },
    }),
  ]);

  // Provide model choices from your registry
  const models = MODEL_REGISTRY.map((m) => ({
    id: m.id,
    name: m.name,
    tools: m.tools,
    reasoning: !!m.reasoning,
  }));

  // Prompt modes you’re using in your combos
  const promptModes = ["baseline", "few_shot", "schema_guided"] as const;

  const driftCases = [
    "none",
    "header_noise",
    "unit_change",
    "type_shift",
    "missing_field",
    "multi_table",
  ] as const;

  return {
    files,
    specs,
    models,
    promptModes: [...promptModes],
    driftCases: [...driftCases],
  };
}

export async function listExperiments() {
  const exps = await prisma.experiment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      datasetFile: { select: { filename: true } },
      spec: { select: { name: true, version: true } },
      trials: { select: { id: true } },
    },
  });
  return exps.map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description ?? "",
    createdAt: e.createdAt.toISOString(),
    datasetLabel: e.datasetFile.filename,
    specLabel: `${e.spec.name} · ${e.spec.version}`,
    trialsCount: e.trials.length,
  }));
}

export async function createExperiment(input: {
  name: string;
  description?: string;
  datasetFileId: string;
  specId: string;
  matrix: Sweep;
}) {
  // Ensure Spec.raw exists (runExperiment will also check)
  const spec = await prisma.spec.findUnique({
    where: { id: input.specId },
    select: { raw: true },
  });
  if (!spec?.raw) throw new Error("Selected Spec has no raw payload");

  const exp = await prisma.experiment.create({
    data: {
      name: input.name,
      description: input.description,
      datasetFileId: input.datasetFileId,
      specId: input.specId,
      matrix: input.matrix as any,
    },
  });

  revalidatePath("/experiments");
  return { id: exp.id };
}

export async function runExistingExperiment(
  experimentId: string,
  opts?: { concurrency?: number; dryRun?: boolean }
) {
  const summary = await runExperiment(experimentId, {
    concurrency: opts?.concurrency,
    dryRun: opts?.dryRun,
  });
  // No DB writes here beyond what runExperiment does; just revalidate list
  revalidatePath("/experiments");
  return summary;
}

export async function deleteExperiment(experimentId: string) {
  await prisma.experiment.delete({ where: { id: experimentId } });
  revalidatePath("/experiments");
}

type TrialRow = {
  id: string;
  modelId: string;
  promptMode: string | null;
  unitTool: boolean;
  driftCase: string | null;
  passed: boolean;
  validationRunId: string;
  f1?: number;
  validRows?: number;
  totalRows?: number;
  issuesCount: number;
  createdAt: string;
};

export type ExperimentDetail = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  datasetLabel: string;
  specLabel: string;
  matrix: {
    models: string[];
    promptModes: string[];
    unitTool: boolean[];
    driftCases: (string | null)[];
    combinations: number;
  };
  trialsCount: number;
  passedCount: number;
  failedCount: number;
  trials: TrialRow[];
};

export async function getExperimentDetail(
  experimentId: string
): Promise<ExperimentDetail> {
  const exp = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      datasetFile: { select: { filename: true } },
      spec: { select: { name: true, version: true } },
      trials: {
        orderBy: { createdAt: "desc" },
        include: {
          validationRun: {
            select: {
              id: true,
              passed: true,
              metrics: true,
              unitTool: true,
              modelId: true,
              promptMode: true,
              driftCase: true,
              createdAt: true,
              _count: { select: { issues: true } },
            },
          },
        },
      },
    },
  });
  if (!exp) throw new Error("Experiment not found");

  const m = exp.matrix as {
    models: string[];
    promptModes: string[];
    unitTool: boolean[];
    driftCases: (string | null)[];
  };

  const trials: TrialRow[] = exp.trials.map((t) => {
    const v = t.validationRun!;
    const metrics = (v.metrics as any) ?? {};
    const f1 = metrics?.schemaMatch?.f1 as number | undefined;
    const validRows = metrics?.validRows as number | undefined;
    const totalRows = metrics?.totalRows as number | undefined;

    return {
      id: t.id,
      modelId: v.modelId ?? t.modelId,
      promptMode: v.promptMode ?? t.promptMode,
      unitTool: v.unitTool ?? t.unitTool,
      driftCase: v.driftCase ?? t.driftCase,
      passed: v.passed,
      validationRunId: v.id,
      f1,
      validRows,
      totalRows,
      issuesCount: (v as any)._count?.issues ?? 0,
      createdAt: v.createdAt.toISOString(),
    };
  });

  const passedCount = trials.filter((t) => t.passed).length;

  return {
    id: exp.id,
    name: exp.name,
    description: exp.description,
    createdAt: exp.createdAt.toISOString(),
    datasetLabel: exp.datasetFile.filename,
    specLabel: `${exp.spec.name} · ${exp.spec.version}`,
    matrix: {
      models: m.models ?? [],
      promptModes: m.promptModes ?? [],
      unitTool: m.unitTool ?? [],
      driftCases: m.driftCases ?? [],
      combinations:
        (m.models?.length ?? 0) *
        (m.promptModes?.length ?? 0) *
        (m.unitTool?.length ?? 0) *
        (m.driftCases?.length ?? 0),
    },
    trialsCount: trials.length,
    passedCount,
    failedCount: trials.length - passedCount,
    trials,
  };
}

export async function runAgain(
  experimentId: string,
  opts: { concurrency?: number; dryRun?: boolean }
) {
  const res = await runExistingExperiment(experimentId, opts);
  revalidatePath(`/experiments/${experimentId}`);
  return res;
}
