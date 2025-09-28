"use server";
import { Sweep } from "@/app/(chat)/api/experiment/schema";
import { MODEL_REGISTRY } from "@/lib/ai/models";
import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import {
  compareFieldSets,
  typeMatchRate,
  unitMatchRate,
} from "@/lib/spec-metrics";
import { zodFromSpec } from "@/lib/validator";
import { runValidation, ValidationIssue } from "@/services/validate-run";
import { SchemaGenOptions } from "@/types/schema";
import { SpecDoc } from "@/types/spec";
import { parse } from "csv-parse/sync";
import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import z from "zod/v3";
import { generatePredictedSpec } from "./schema-gen";
import { writeModelRun } from "./telemetry";

export type RunSummary = {
  experimentId: string;
  combinations: number;
  trialsCreated: number;
  validationRunsCreated: number;
  errors: Array<{ combo: Record<string, unknown>; error: string }>;
};

export async function runExperiment(
  experimentId: string,
  opts?: {
    concurrency?: number;
    dryRun?: boolean;
    onBatch?: (info: {
      done: number; // combos completed so far
      total: number; // all combos
      batchIndex: number; // 0-based
      batchSize: number;
    }) => Promise<void> | void;
    shouldCancel?: () => Promise<boolean> | boolean;
  }
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

  const total = combos.length;
  const concurrency = Math.max(1, Math.min(8, opts?.concurrency ?? 1));
  let done = 0;

  for (let i = 0; i < combos.length; i += concurrency) {
    const batch = combos.slice(i, i + concurrency);
    const batchIndex = Math.floor(i / concurrency);

    const results = await Promise.allSettled(
      batch.map(async (c) => {
        try {
          const latestProfile = await prisma.datasetProfile.findFirst({
            where: { datasetFileId: exp.datasetFileId },
            orderBy: { createdAt: "desc" },
          });

          const specDoc = exp.spec!.raw as SpecDoc;
          console.log(c.promptMode, " @PromptMode");

          if (c.promptMode === "validation_only") {
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
                experimentId,
                promptMode: c.promptMode,
                unitTool: c.unitTool,
                driftCase: c.driftCase ?? null,
                passed: validation.passed,
                metrics: validation.metrics as any,
                issues: { create: validation.issues.slice(0, 50) },
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
          } else {
            console.log("@runOneCombo");
            const res = await runOneCombo({
              experimentId: exp.id,
              modelId: c.modelId,
              promptMode: c.promptMode as any, // "baseline" | "few_shot" | "schema_guided"
              unitTool: c.unitTool,
              driftCase: c.driftCase ?? null,
              datasetFileId: exp.datasetFileId,
              spec: specDoc,
              dryRun: !!opts?.dryRun,
            });

            if (!opts?.dryRun) {
              // runOneCombo persisted ValidationRun + Trial already
              validationRunsCreated++;
              trialsCreated++;
            }
            console.log("@runOneCombo success: ", res);
            void res;
          }
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

    done += batch.length;
    if (opts?.onBatch) {
      await opts.onBatch({
        done,
        total,
        batchIndex,
        batchSize: batch.length,
      });
    }
    if (opts?.shouldCancel && (await opts.shouldCancel())) {
      break;
    }
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
  const promptModes = [
    "validation_only",
    "baseline",
    "few_shot",
    "schema_guided",
  ] as const;

  const driftCases = [
    "none",
    "header_noise",
    "unit_change",
    "type_shift",
    "missing_field",
    "multi_table",
  ] as const;

  const unitTools = [false, true] as const;

  return {
    files,
    specs,
    models,
    promptModes: [...promptModes],
    unitTools: [...unitTools],
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
  opts?: {
    concurrency?: number;
    dryRun?: boolean;
    onBatch?: (info: {
      done: number; // combos completed so far
      total: number; // all combos
      batchIndex: number; // 0-based
      batchSize: number;
    }) => Promise<void> | void;
    shouldCancel?: () => Promise<boolean> | boolean;
  }
) {
  const summary = await runExperiment(experimentId, opts);
  // No DB writes here beyond what runExperiment does; just revalidate list
  revalidatePath("/experiments");
  return summary;
}

export async function deleteExperiment(experimentId: string) {
  await prisma.experiment.delete({ where: { id: experimentId } });
  revalidatePath("/experiments");
}

export type TrialRow = {
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
  validRowsPct?: number;
  precision?: number;
  recall?: number;
  typeAcc?: number;
  unitAcc?: number;
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

  const specDoc: SpecDoc | undefined = (exp.spec as any)?.raw ?? undefined;

  const m = exp.matrix as {
    models: string[];
    promptModes: string[];
    unitTool: boolean[];
    driftCases: (string | null)[];
  };

  const trials: TrialRow[] = exp.trials.map((t) => {
    const v = t.validationRun!;
    const metrics = (v.metrics as any) ?? {};

    const f1: number | undefined = metrics?.schemaMatch?.f1;
    const precision: number | undefined = metrics?.schemaMatch?.precision;
    const recall: number | undefined = metrics?.schemaMatch?.recall;
    let typeAcc: number | undefined = metrics?.typeAcc;
    let unitAcc: number | undefined = metrics?.unitAcc;

    const validRows = metrics?.validRows as number | undefined;
    const totalRows = metrics?.totalRows as number | undefined;
    const validRowsPct: number | undefined =
      metrics?.validRowsPct ??
      (typeof validRows === "number" &&
      typeof totalRows === "number" &&
      totalRows > 0
        ? validRows / totalRows
        : undefined);

    // fallback recompute if possible (schema-gen runs that stored predictedSpec)
    if (
      (typeAcc == null || unitAcc == null) &&
      metrics?.predictedSpec &&
      specDoc
    ) {
      try {
        const sm = compareFieldSets(specDoc, metrics.predictedSpec);
        // if precision/recall missing, fill from recompute too
        if (precision == null && typeof sm.precision === "number")
          metrics.schemaMatch ??= sm;
        if (recall == null && typeof sm.recall === "number")
          metrics.schemaMatch ??= sm;

        typeAcc = typeAcc ?? typeMatchRate(specDoc, metrics.predictedSpec);
        unitAcc = unitAcc ?? unitMatchRate(specDoc, metrics.predictedSpec);
      } catch {
        // ignore recompute errors, keep undefined
      }
    }

    return {
      id: t.id,
      modelId: v.modelId ?? t.modelId,
      promptMode: v.promptMode ?? t.promptMode,
      unitTool: v.unitTool ?? t.unitTool,
      driftCase: v.driftCase ?? t.driftCase,
      passed: v.passed,
      validationRunId: v.id,
      f1,
      precision,
      recall,
      typeAcc,
      unitAcc,
      validRows,
      totalRows,
      validRowsPct,
      issuesCount: (v as any)._count?.issues ?? 0,
      createdAt: v.createdAt.toISOString(),
    } as TrialRow;
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

export async function runOneCombo(args: {
  experimentId: string;
  modelId: string;
  promptMode: SchemaGenOptions["promptMode"];
  unitTool: boolean;
  driftCase: string | null;
  datasetFileId: string;
  spec: SpecDoc;
  dryRun: boolean;
}) {
  const {
    experimentId,
    modelId,
    promptMode,
    unitTool,
    driftCase,
    datasetFileId,
    spec,
    dryRun,
  } = args;

  // If "validation_only", keep your current path.
  if (promptMode === "validation_only") {
    const started = Date.now();

    // 1) Call with positional args (unitTool goes inside opts)
    const val = await runValidation(datasetFileId, spec, { unitTool });

    // 2) Persist like the LLM path so Chapter 5 queries stay uniform
    const specRow = await prisma.spec.findFirstOrThrow({
      where: { name: spec.name, version: spec.version },
    });

    const vrun = await prisma.validationRun.create({
      data: {
        datasetFileId,
        specId: specRow.id,
        modelId, // still store which model the trial belongs to (even if no LLM used)
        experimentId,
        promptMode, // "validation_only"
        unitTool,
        driftCase, // keep for symmetry with other trials
        passed: val.passed,
        metrics: val.metrics as any, // { schemaMatch:{p,r,f1}, validRows, totalRows, ... }
        profileHash: null,
        issues: {
          create: val.issues.slice(0, 50),
        },
      },
    });

    const trial = await prisma.trial.create({
      data: {
        experimentId,
        modelId,
        promptMode,
        unitTool,
        driftCase,
        validationRunId: vrun.id,
        result: {
          f1: val.metrics.schemaMatch.f1,
          precision: val.metrics.schemaMatch.precision,
          recall: val.metrics.schemaMatch.recall,
          validRowsPct: val.metrics.totalRows
            ? val.metrics.validRows / val.metrics.totalRows
            : undefined,
        } as any,
      },
    });

    // 3) Optional: write ModelRun so your perf charts also show these runs
    await writeModelRun({
      chatId: `exp:${experimentId}`,
      userMessageId: `trial:${trial.id}`,
      modelId,
      tag: `exp/validation_only:${spec.domain ?? "generic"}:${
        driftCase ?? "none"
      }`,
      durationClientMs: Date.now() - started,
    });

    return {
      trialId: trial.id,
      f1: val.metrics.schemaMatch.f1,
      passed: val.passed,
    };
  }

  // ===== LLM schema extraction path =====
  const started = Date.now();
  console.log(
    "Start generate predict spec, ",
    modelId,
    promptMode,
    spec.domain,
    driftCase
  );
  const { object: predicted, telemetry } = await generatePredictedSpec({
    modelId,
    datasetFileId,
    promptMode: promptMode,
    domainHint: spec.domain ?? null,
    driftCase,
    stream: false, // true to capture TTFT
    timeoutMs: 45_000, // tweak if needed
    fallbackToNonStreaming: true,
  });
  console.log("@runOneCombo: generated spec", predicted, telemetry);

  // Score vs ground truth
  const sm = compareFieldSets(spec, predicted);
  const typeAcc = typeMatchRate(spec, predicted);
  const unitAcc = unitMatchRate(spec, predicted);

  // Optional: validate dataset using predicted schema to measure valid-rows%
  let validRows: number | undefined;
  let totalRows: number | undefined;
  let validRowsPct: number | undefined;
  let valIssues: ValidationIssue[] = [];
  try {
    const predSpecLike: SpecDoc = {
      name: predicted.title ?? `${spec.name}-predicted`,
      version: predicted.version,
      fields: predicted.fields.map((f) => ({
        name: f.name,
        type: f.type,
        nullable: f.nullable,
        unit: f.unit ?? undefined,
        enumVals: f.enumVals ?? [],
        isPrimary: f.isPrimary ?? false,
      })),
    };
    const z = zodFromSpec(predSpecLike, { unitTool });
    console.log("@runOneCombo: start validating");
    const { analyzed, issues } = await validateDatasetWithZod(datasetFileId, z); // helper in this file, see below
    console.log("@runOneCombo: start validated: ", analyzed);
    validRows = analyzed.ok;
    totalRows = analyzed.total;
    validRowsPct = analyzed.validRowsPct;
    valIssues = issues;
  } catch {
    validRows = undefined;
    totalRows = undefined;
    validRowsPct = undefined;
  }

  console.log("@runOneCombo: pesisting to db");
  // Persist ValidationRun + Trial
  const valRun = await prisma.validationRun.create({
    data: {
      datasetFileId,
      specId: (
        await prisma.spec.findFirstOrThrow({
          where: { name: spec.name, version: spec.version },
        })
      ).id,
      modelId,
      experimentId,
      promptMode,
      unitTool,
      driftCase,
      passed: sm.f1 >= 0.9, // threshold you can tune
      metrics: {
        schemaMatch: sm,
        typeAcc,
        unitAcc,
        validRows,
        totalRows,
        validRowsPct,
        predictedSpec: predicted,
      } as any,
      profileHash: null,
      issues: {
        create: valIssues.slice(0, 50),
      },
    },
  });

  const trial = await prisma.trial.create({
    data: {
      experimentId,
      modelId,
      promptMode,
      unitTool,
      driftCase,
      validationRunId: valRun.id,
      result: {
        f1: sm.f1,
        precision: sm.precision,
        recall: sm.recall,
        typeAcc,
        unitAcc,
        validRowsPct,
      } as any,
    },
  });

  console.log("@runOneCombo: writing telemetry");
  // Telemetry row so your /admin/dashboard charts update
  await writeModelRun({
    chatId: `exp:${experimentId}`,
    userMessageId: `trial:${trial.id}`,
    modelId,
    tag: `exp/schema:${promptMode}:${spec.domain ?? "generic"}:${
      driftCase ?? "none"
    }`,
    durationClientMs: Date.now() - started,
    durationServerMs: telemetry.durationServerMs,
    ttftMs: telemetry.ttftMs,
    inputTokens: telemetry?.inputTokens ?? null,
    outputTokens: telemetry?.outputTokens ?? null,
    totalTokens: telemetry?.totalTokens ?? null,
  });

  return { trialId: trial.id, f1: sm.f1, passed: sm.f1 >= 0.9 };
}

export async function validateDatasetWithZod(
  datasetFileId: string,
  rowSchema: z.ZodTypeAny
) {
  const file = await prisma.datasetFile.findUniqueOrThrow({
    where: { id: datasetFileId },
  });
  const text = Buffer.from(file.data).toString("utf8");
  const rows: string[][] = parse(text, {
    skip_empty_lines: true,
    delimiter: [";", ","],
  });
  const issues: ValidationIssue[] = [];

  if (!rows.length) {
    return {
      analyzed: { total: 0, ok: 0, validRowsPct: 0 },
      issues,
    };
  }

  const canon = (s: string) => s.normalize("NFKC").trim().toLowerCase();

  const header = rows[0];
  const body = rows.slice(1);

  // If rowSchema is a ZodObject, get its keys; else fall back to header
  const schemaKeys =
    rowSchema instanceof z.ZodObject
      ? Object.keys((rowSchema as z.ZodObject<any>).shape)
      : header.slice();

  // Map: lower(schemaKey) -> schemaKey (exact case used in schema)
  const schemaKeyByLower: Record<string, string> = {};
  for (const k of schemaKeys) schemaKeyByLower[canon(k)] = k;

  // Build a case-insensitive header index and a pretty-name map
  const headerIndexByLower: Record<string, number> = {};
  const prettyHeaderByLower: Record<string, string> = {};
  header.forEach((h, i) => {
    const k = canon(h);
    if (!(k in headerIndexByLower)) {
      headerIndexByLower[k] = i;
      prettyHeaderByLower[k] = h; // remember original CSV casing
    }
  });

  // ----- Column diagnostics (missing/extra/case mismatch) -----
  const missingCols = schemaKeys.filter(
    (k) => !(canon(k) in headerIndexByLower)
  );
  const extraCols = header.filter((h) => !(canon(h) in schemaKeyByLower));
  const capitalMismatch = schemaKeys.filter((k) => {
    const lk = canon(k);
    const present = lk in headerIndexByLower;
    if (!present) return false;
    const csvName = prettyHeaderByLower[lk];
    return csvName !== k; // same letters but different casing
  });

  missingCols.forEach((c) =>
    issues.push({
      severity: "error",
      code: "MISSING_COLUMN",
      colName: c,
      message: `Column ${c} not found`,
    })
  );

  extraCols.forEach((c) =>
    issues.push({
      severity: "warn",
      code: "EXTRA_COLUMN",
      colName: c,
      message: `Unexpected column ${c}`,
    })
  );

  capitalMismatch.forEach((c) =>
    issues.push({
      severity: "warn",
      code: "CAPITAL_MISMATCH",
      colName: c,
      message: `Capital letter mismatch for column ${c}`,
    })
  );

  const colIndex = Object.fromEntries(header.map((h, i) => [h, i] as const));
  let ok = 0;
  body.forEach((r, idx) => {
    const obj: Record<string, unknown> = {};

    // Populate ONLY the keys as named in the schema (exact case)
    for (const schemaKey of schemaKeys) {
      const lk = canon(schemaKey);
      const i = headerIndexByLower[lk];
      obj[schemaKey] = i == null ? undefined : r[i];
    }

    const res = rowSchema.safeParse(obj);
    if (res.success) {
      ok++;
    } else {
      for (const e of res.error.issues) {
        // Handle strict-object "unrecognized_keys" specially (no path)
        if ((e as any).code === "unrecognized_keys") {
          const keys: string[] = (e as any).keys ?? [];
          for (const k of keys) {
            const pretty = prettyHeaderByLower[canon(k)] ?? k;
            issues.push({
              severity: "warn", // or "error" if you want to fail hard
              code: "UNRECOGNIZED_KEY",
              colName: pretty,
              rowIndex: idx + 1,
              message: `Unrecognized key ${pretty}`,
            });
          }
          continue;
        }

        // Normal per-field issues
        const rawPath = String(e.path?.[0] ?? "");
        const pretty = (prettyHeaderByLower[canon(rawPath)] ?? rawPath) || "—";
        issues.push({
          severity: "error",
          code: "TYPE_OR_RULE_MISMATCH",
          colName: pretty,
          rowIndex: idx + 1,
          message: e.message,
        });
      }
    }
  });

  return {
    analyzed: {
      total: body.length,
      ok,
      validRowsPct: body.length ? ok / body.length : 0,
    },
    issues,
  };
}

export async function prepExperimentRun(experimentId: string) {
  noStore();
  const exp = await prisma.experiment.findUniqueOrThrow({
    where: { id: experimentId },
  });
  const matrix = exp.matrix as Sweep;
  const total =
    matrix.models.length *
    matrix.promptModes.length *
    matrix.unitTool.length *
    matrix.driftCases.length;

  const baseline = await prisma.trial.count({ where: { experimentId } });
  return { total, baseline };
}

export async function countTrials(experimentId: string) {
  noStore();
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "Trial" WHERE "experimentId" = $1`,
    experimentId
  );
  return { done: Number(rows[0]?.count ?? 0) };
}

export async function beginExperimentRun(
  experimentId: string,
  opts: { concurrency?: number; dryRun?: boolean }
) {
  // compute totals as you already do
  const { total, baseline } = await prepExperimentRun(experimentId);

  // create a run row
  const run = await prisma.experimentRun.create({
    data: { experimentId, status: "RUNNING", total, baseline, done: 0 },
    select: { id: true },
  });

  // fire-and-forget the long job, but keep status in DB
  // (node environment required; on serverless use a queue)
  void (async () => {
    try {
      await runExistingExperiment(experimentId, {
        concurrency: opts.concurrency ?? 1,
        dryRun: !!opts.dryRun,
        onBatch: async () => {
          // update progress after each batch
          const { done } = await countTrials(experimentId);
          await prisma.experimentRun.update({
            where: { id: run.id },
            data: { done },
          });
          // check cancel flag
          const me = await prisma.experimentRun.findUnique({
            where: { id: run.id },
            select: { cancelRequested: true },
          });
          if (me?.cancelRequested) throw new Error("CANCELLED");
        },
      });
      await prisma.experimentRun.update({
        where: { id: run.id },
        data: { status: "DONE", finishedAt: new Date() },
      });
    } catch (e: any) {
      const cancelled = String(e?.message).toUpperCase().includes("CANCELLED");
      await prisma.experimentRun.update({
        where: { id: run.id },
        data: {
          status: cancelled ? "CANCELLED" : "FAILED",
          finishedAt: new Date(),
          error: cancelled ? null : String(e?.message ?? e),
        },
      });
    }
  })();

  return { runId: run.id, total, baseline };
}

export async function cancelExperimentRun(runId: string) {
  await prisma.experimentRun.update({
    where: { id: runId },
    data: { cancelRequested: true },
  });
}

export async function getActiveRuns() {
  const rows = await prisma.experimentRun.findMany({
    where: { status: "RUNNING" },
    select: {
      id: true,
      experimentId: true,
      total: true,
      baseline: true,
      done: true,
      updatedAt: true,
    },
    orderBy: { startedAt: "desc" },
  });
  return rows;
}

export async function getRunStatus(runId: string) {
  const r = await prisma.experimentRun.findUnique({ where: { id: runId } });
  if (!r) return { missing: true };
  return {
    status: r.status,
    total: r.total,
    baseline: r.baseline,
    done: r.done,
    cancelRequested: r.cancelRequested,
    error: r.error,
  };
}

export async function deleteRuns(runId: string) {
  const res = await prisma.trial.deleteMany({
    where: {
      experimentId: runId,
    },
  });
  await prisma.modelRun.deleteMany({
    where: {
      chatId: {
        contains: runId,
      },
    },
  });
  await prisma.validationRun.deleteMany({
    where: {
      experimentId: runId,
    },
  });
  revalidatePath("/experiments");
  return res;
}
