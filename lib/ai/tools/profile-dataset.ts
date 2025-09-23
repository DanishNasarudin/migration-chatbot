import prisma from "@/lib/prisma";
import { computeNullRate, detectUnits, inferType } from "@/lib/profiler";
import {
  ColumnProfile,
  DatasetProfileResult,
  profileDatasetFile,
} from "@/services/profile";
import { tool } from "ai";
import { createHash } from "crypto";
import z from "zod/v3";

const cuid = () => z.string().cuid();

export const profileDataset = tool({
  description:
    "Profile a dataset by computing per-column stats and inferred types.",
  inputSchema: z.object({
    datasetFileId: cuid().describe("ID of the uploaded DatasetFile to profile"),
  }),
  execute: async ({ datasetFileId }): Promise<DatasetProfileResult> => {
    console.log("ai-tool: profileDataset called");
    const result = await profileDatasetFile(datasetFileId);
    const enhancedColumns: ColumnProfile[] = result.columns.map((c: any) => {
      const samples: unknown[] = Array.isArray(c.samples)
        ? c.samples.slice(0, 200)
        : [];
      return {
        name: c.name,
        inferredType: c.inferredType ?? inferType(samples),
        nullRate:
          typeof c.nullRate === "number"
            ? c.nullRate
            : computeNullRate(samples, result.rowCount),
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
          rc: result.rowCount,
          cols: enhancedColumns.map((c) => c.name),
        })
      )
      .digest("hex");

    const latestProfile = await prisma.datasetProfile.findFirst({
      where: { datasetFileId },
      orderBy: { createdAt: "desc" },
    });
    if (latestProfile)
      throw new Error(
        `Dataset profile already exists. datasetFileId: ${datasetFileId}`
      );

    // persist a DatasetProfile row (optional, if your service doesn’t do it)
    await prisma.datasetProfile.create({
      data: {
        datasetFileId,
        columns: enhancedColumns as unknown as any,
        rowCount: result.rowCount,
        sampleHash,
      },
    });

    return result;
  },
});
