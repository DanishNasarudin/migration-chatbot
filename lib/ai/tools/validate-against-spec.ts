import prisma from "@/lib/prisma";
import { computeNullRate, detectUnits, inferType } from "@/lib/profiler";
import {
  ColumnProfile,
  DatasetProfileResult,
  profileDatasetFile,
} from "@/services/profile";
import { runValidation } from "@/services/validate-run";
import { SpecDoc } from "@/types/spec";
import { tool } from "ai";
import { createHash } from "crypto";
import z from "zod/v3";

const cuid = () => z.string().cuid();

export type ValidateResult = {
  id: string; // validationRunId
  passed: boolean;
  metrics: {
    schemaMatch: { precision: number; recall: number; f1: number };
    validRows: number;
    totalRows: number;
  };
  issues: Array<{
    severity: "info" | "warn" | "error";
    code: string;
    colName?: string | null;
    rowIndex?: number | null;
    value?: string | null;
    expected?: string | null;
    message: string;
  }>;
};

export const validateAgainstSpec = tool({
  description:
    "Validate a dataset against a versioned Spec. Returns pass/fail, metrics, and issues.",
  inputSchema: z.object({
    fileId: cuid().describe("DatasetFile ID"),
    specId: cuid().describe("Spec ID"),
    unitTool: z
      .boolean()
      .optional()
      .describe("Enable unit-helper during validation"),
  }),
  execute: async ({
    fileId: datasetFileId,
    specId,
    unitTool,
  }): Promise<ValidateResult> => {
    console.log("ai-tool: validateAgainstSpec called");
    // 1) Get latest DatasetProfile (or create if missing)
    let profile = await prisma.datasetProfile.findFirst({
      where: { datasetFileId },
      orderBy: { createdAt: "desc" },
    });

    if (!profile) {
      // Auto-profile if none exists
      const p = await profileDatasetFile(datasetFileId);
      const enhancedColumns: ColumnProfile[] = p.columns.map((c: any) => {
        const samples: unknown[] = Array.isArray(c.samples)
          ? c.samples.slice(0, 200)
          : [];
        return {
          name: c.name,
          inferredType: c.inferredType ?? inferType(samples),
          nullRate:
            typeof c.nullRate === "number"
              ? c.nullRate
              : computeNullRate(samples, p.rowCount),
          distinctCount:
            typeof c.distinctCount === "number"
              ? c.distinctCount
              : new Set(
                  samples
                    .filter((v) => v != null && v !== "")
                    .map((v) => String(v))
                ).size,
          unitCandidates:
            Array.isArray(c.unitCandidates) && c.unitCandidates.length
              ? c.unitCandidates
              : detectUnits(c.name, samples),
        };
      });

      const sampleHash = createHash("sha1")
        .update(
          JSON.stringify({
            rc: p.rowCount,
            cols: enhancedColumns.map((c) => c.name),
          })
        )
        .digest("hex");

      profile = await prisma.datasetProfile.create({
        data: {
          datasetFileId,
          columns: enhancedColumns as any,
          rowCount: p.rowCount,
          sampleHash,
        },
      });
    }

    // 2) Reuse a cached passing ValidationRun for same (dataset, spec, unitTool, profileHash)
    const cached = await prisma.validationRun.findFirst({
      where: {
        datasetFileId,
        specId,
        unitTool: !!unitTool,
        driftCase: null,
        profileHash: profile.sampleHash,
        passed: true,
      },
      orderBy: { createdAt: "desc" },
      include: { issues: true },
    });

    if (cached) {
      return toValidateResult(cached);
    }

    // 3) Run fresh validation (profile-aware)
    const specRow = await prisma.spec.findUniqueOrThrow({
      where: { id: specId },
    });
    const spec = specRow.raw as SpecDoc;

    const result = await runValidation(datasetFileId, spec, {
      unitTool: !!unitTool,
      profile: profile as unknown as DatasetProfileResult, // pass profile in for extra checks
    });

    const run = await prisma.validationRun.create({
      data: {
        datasetFileId,
        specId,
        modelId: null,
        promptMode: null,
        unitTool: !!unitTool,
        driftCase: null,
        profileHash: profile.sampleHash, // tie run to profile
        passed: result.passed,
        metrics: result.metrics as any,
        issues: { create: result.issues },
      },
      include: { issues: true },
    });

    return toValidateResult(run);
  },
});

function toValidateResult(run: {
  id: string;
  passed: boolean;
  metrics: unknown;
  issues: Array<{
    severity: string;
    code: string;
    colName: string | null;
    rowIndex: number | null;
    value: string | null;
    expected: string | null;
    message: string;
  }>;
}) {
  return {
    id: run.id,
    passed: run.passed,
    metrics: run.metrics as {
      schemaMatch: { precision: number; recall: number; f1: number };
      validRows: number;
      totalRows: number;
      // … (any extras)
    },
    issues: run.issues.map((i) => ({
      severity: (i.severity as "info" | "warn" | "error") ?? "error",
      code: i.code,
      colName: i.colName ?? undefined,
      rowIndex: i.rowIndex ?? undefined,
      value: i.value ?? undefined,
      expected: i.expected ?? undefined,
      message: i.message,
    })),
  };
}
