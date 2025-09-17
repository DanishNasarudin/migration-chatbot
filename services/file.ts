import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
