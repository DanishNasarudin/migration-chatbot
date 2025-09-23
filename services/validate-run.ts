"use server";
import prisma from "@/lib/prisma";
import { SpecDoc } from "@/types/spec";
import { parse } from "csv-parse/sync";
import { revalidatePath } from "next/cache";
import { zodFromSpec } from "../lib/validator";
import { DatasetProfileResult } from "./profile";

export type ValidationIssue = {
  severity: "info" | "warn" | "error";
  code: string;
  colName?: string;
  rowIndex?: number;
  value?: string;
  expected?: string;
  message: string;
};

export type ValidationMetrics = {
  schemaMatch: { precision: number; recall: number; f1: number };
  validRows: number;
  totalRows: number;
  profileDrift?: {
    missingInProfile: string[];
    newInProfile: string[];
    typeDisagreements: Array<{ column: string; spec: string; profile: string }>;
    highNulls: Array<{ column: string; nullRate: number; threshold: number }>;
  };
};

export type ValidationResult = {
  passed: boolean;
  metrics: ValidationMetrics;
  issues: ValidationIssue[];
};

export async function runValidation(
  datasetFileId: string,
  spec: SpecDoc,
  opts: {
    unitTool?: boolean;
    profile?: DatasetProfileResult;
    thresholds?: { nullRate?: number };
  } = {}
): Promise<ValidationResult> {
  const file = await prisma.datasetFile.findUniqueOrThrow({
    where: { id: datasetFileId },
  });
  const text = Buffer.from(file.data).toString("utf8");
  const [header, ...rows] = parse(text, {
    skip_empty_lines: true,
  }) as string[][];
  const zodSchema = zodFromSpec(spec);

  const issues: ValidationIssue[] = [];

  // Header presence
  const expected = new Set(spec.fields.map((f) => f.name));
  const found = new Set(header);
  const missingCols = [...expected].filter((n) => !found.has(n));
  const extraCols = [...found].filter((n) => !expected.has(n));
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

  // Row validation
  const colIndex = Object.fromEntries(header.map((h, i) => [h, i]));
  let validRows = 0;
  rows.forEach((r, idx) => {
    const obj: Record<string, unknown> = {};
    for (const f of spec.fields) obj[f.name] = r[colIndex[f.name]];
    const res = zodSchema.safeParse(obj);
    if (!res.success) {
      for (const e of res.error.issues) {
        issues.push({
          severity: "error",
          code: "TYPE_OR_RULE_MISMATCH",
          colName: String(e.path[0] ?? ""),
          rowIndex: idx + 1,
          message: e.message,
        });
      }
    } else {
      validRows++;
    }
  });

  // Schema-match metrics
  const tp = spec.fields.filter((f) => found.has(f.name)).length;
  const precision = tp / (tp + extraCols.length || 1);
  const recall = tp / (tp + missingCols.length || 1);
  const f1 = (2 * precision * recall) / (precision + recall || 1);

  // ----- Profile-aware extras -----
  const profile = opts.profile;
  const profileDrift: ValidationMetrics["profileDrift"] = profile
    ? computeProfileDrift(spec, profile, {
        nullRateThreshold: opts.thresholds?.nullRate ?? 0.2,
      })
    : undefined;

  if (profileDrift) {
    profileDrift.typeDisagreements.forEach((d) =>
      issues.push({
        severity: "warn",
        code: "PROFILE_TYPE_DRIFT",
        colName: d.column,
        message: `Spec type ${d.spec} vs profile type ${d.profile}`,
      })
    );
    profileDrift.highNulls.forEach((n) =>
      issues.push({
        severity: "warn",
        code: "PROFILE_HIGH_NULL_RATE",
        colName: n.column,
        message: `Null-rate ${n.nullRate.toFixed(2)} exceeds threshold ${
          n.threshold
        }`,
      })
    );
  }

  const passed = !issues.some((i) => i.severity === "error");

  return {
    passed,
    metrics: {
      schemaMatch: { precision, recall, f1 },
      validRows,
      totalRows: rows.length,
      profileDrift,
    },
    issues,
  };
}

function computeProfileDrift(
  spec: SpecDoc,
  profile: DatasetProfileResult,
  opts: { nullRateThreshold: number }
) {
  const specCols = new Set(spec.fields.map((f) => f.name));
  const profCols = new Set(profile.columns.map((c) => c.name));
  const missingInProfile = [...specCols].filter((c) => !profCols.has(c));
  const newInProfile = [...profCols].filter((c) => !specCols.has(c));

  const specType = Object.fromEntries(spec.fields.map((f) => [f.name, f.type]));
  const typeDisagreements: Array<{
    column: string;
    spec: string;
    profile: string;
  }> = [];

  for (const c of profile.columns) {
    const sType = specType[c.name];
    if (!sType) continue;
    if (!agreeType(sType, c.inferredType)) {
      typeDisagreements.push({
        column: c.name,
        spec: sType,
        profile: c.inferredType,
      });
    }
  }

  const highNulls = profile.columns
    .filter((c) => c.nullRate > opts.nullRateThreshold)
    .map((c) => ({
      column: c.name,
      nullRate: c.nullRate,
      threshold: opts.nullRateThreshold,
    }));

  return { missingInProfile, newInProfile, typeDisagreements, highNulls };
}

function agreeType(spec: string, inferred: string) {
  if (spec === inferred) return true;
  // allow mild coercions (e.g., numeric-looking strings)
  if (spec === "number" && inferred === "string") return true;
  return false;
}

type EnsureOpts = {
  datasetFileId: string;
  specId: string;
  unitTool?: boolean;
  sampleHash: string; // from latest DatasetProfile
};

export async function ensureValidOrExplain(opts: EnsureOpts) {
  const { datasetFileId, specId, unitTool = false, sampleHash } = opts;

  // Reuse cached passing run
  const cached = await prisma.validationRun.findFirst({
    where: { datasetFileId, specId, unitTool, driftCase: null },
    orderBy: { createdAt: "desc" },
  });

  if (cached?.passed) {
    // Optional: check staleness by comparing to latest profile hash
    const latestProfile = await prisma.datasetProfile.findFirst({
      where: { datasetFileId },
      orderBy: { createdAt: "desc" },
    });
    const isFresh = latestProfile?.sampleHash === sampleHash;
    if (isFresh) return { ok: true as const, runId: cached.id };
  }

  // Run once if no fresh pass
  const specRow = await prisma.spec.findUniqueOrThrow({
    where: { id: specId },
  });
  const spec = specRow.raw as SpecDoc;

  const result = await runValidation(datasetFileId, spec, { unitTool });
  const run = await prisma.validationRun.create({
    data: {
      datasetFileId,
      specId,
      modelId: null,
      promptMode: null,
      unitTool,
      driftCase: null,
      passed: result.passed,
      metrics: result.metrics as any,
      issues: { create: result.issues },
    },
  });

  if (!run.passed) {
    return {
      ok: false as const,
      message: "Validation failed. Review issues before proceeding.",
      validationRunId: run.id,
    };
  }

  return { ok: true as const, runId: run.id };
}

export async function deleteValidationRun(runId: string) {
  await prisma.validationRun.delete({ where: { id: runId } });
  revalidatePath("/validation");
}
