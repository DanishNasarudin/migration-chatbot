"use server";
import { Sweep } from "@/app/(chat)/api/experiment/schema";
import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { runValidation } from "@/services/validate-run";
import { SpecDoc } from "@/types/spec";

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
