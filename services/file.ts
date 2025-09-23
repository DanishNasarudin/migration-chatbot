"use server";

import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { profileDatasetFile } from "./profile";

export async function createFile({
  fileName,
  extension,
  fileType,
  sizeBytes,
  checksumSha256,
  data,
}: {
  fileName: string;
  extension: string;
  fileType: string;
  sizeBytes: number;
  checksumSha256: string;
  data: Buffer<ArrayBuffer>;
}) {
  try {
    const result = await prisma.datasetFile.create({
      data: {
        filename: fileName,
        extension: extension || "",
        mimeType: fileType || "application/octet-stream",
        sizeBytes,
        checksumSha256,
        data,
      },
      select: { id: true, filename: true },
    });

    revalidatePath("/chat");
    return result;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to create file");
  }
}

export async function getProfileAndLatestSpec(datasetFileId: string) {
  // ensure file exists
  const file = await prisma.datasetFile.findUnique({
    where: { id: datasetFileId },
  });
  if (!file) throw new Error("DatasetFile not found");

  // latest profile, or create one
  let profile = await prisma.datasetProfile.findFirst({
    where: { datasetFileId },
    orderBy: { createdAt: "desc" },
  });

  if (!profile) {
    const p = await profileDatasetFile(datasetFileId);
    const sampleHash = createHash("sha1")
      .update(
        JSON.stringify({ rc: p.rowCount, cols: p.columns.map((c) => c.name) })
      )
      .digest("hex");

    profile = await prisma.datasetProfile.create({
      data: {
        datasetFileId,
        columns: p.columns as any, // matches existing schema in repo
        rowCount: p.rowCount,
        sampleHash,
      },
    });
  }

  // latest spec: your save-spec tool uses spec.name === filename
  const latestSpec = await prisma.spec.findFirst({
    where: { name: file.filename },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  return {
    profile: {
      id: profile.id,
      rowCount: profile.rowCount,
      columns: profile.columns as Array<{
        name: string;
        inferredType?: string;
        nullRate?: number;
        distinctCount?: number;
        unitCandidates?: string[];
      }>,
      createdAt: profile.createdAt,
    },
    latestSpecId: latestSpec?.id ?? null,
    filename: file.filename,
  };
}

export async function deleteDatasetFile(datasetFileId: string) {
  // You may want to cascade delete related rows via Prisma schema relations
  await prisma.datasetFile.delete({ where: { id: datasetFileId } });
  revalidatePath("/datasets");
}
