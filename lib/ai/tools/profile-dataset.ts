import prisma from "@/lib/prisma";
import { DatasetProfileResult, profileDatasetFile } from "@/services/profile";
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
    const sampleHash = createHash("sha1")
      .update(
        JSON.stringify({
          rc: result.rowCount,
          cols: result.columns.map((c) => c.name),
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
        columns: result.columns as unknown as any,
        rowCount: result.rowCount,
        sampleHash,
      },
    });

    return result;
  },
});
