import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod/v3";
import { bytesFromPrisma, FileBlob, normalizeForModel } from "../helper";

const FileSpec = z
  .object({
    label: z.string(), // e.g. "previousFile", "reference", "schema"
    fileId: z.string().optional(),
  })
  .refine((v) => v.fileId, { message: "fileId required" });

type FileSpec = z.infer<typeof FileSpec>;

export const getChatFiles = tool({
  description:
    "Load multiple labeled files that are available to this chat (e.g. previousFile, schema, goldTruth). Use when have [[FILE_REFERENCE]]",
  inputSchema: z.object({
    chatId: z.string(),
    files: z.array(FileSpec).min(1),
    maxTotalBytes: z
      .number()
      .int()
      .positive()
      .default(8 * 1024 * 1024), // 8MB guard
  }),
  async execute({ chatId, files, maxTotalBytes }) {
    console.log(chatId, files, maxTotalBytes, "THIS TRIGGERED? CHAT");
    // resolve chat & owner
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true },
    });
    if (!chat) throw new Error("chat not found");

    let total = 0;
    const out: Array<{
      label: string;
      filename: string;
      mediaType: string;
      summary: string;
      data: string;
    }> = [];

    // Helper to resolve a DatasetFile by id/checksum/filename with access checks
    const resolveFile = async (spec: FileSpec) => {
      const whereByIdentifier = { id: spec.fileId };

      const file = await prisma.datasetFile.findFirst({
        where: {
          AND: [
            whereByIdentifier as any,
            {
              OR: [
                { chatLinks: { some: { chatId } } }, // linked to this chat
              ],
            },
          ],
        },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          data: true,
          chatLinks: { where: { chatId }, select: { chatId: true } },
        },
      });

      if (!file) {
        throw new Error(`file not accessible to chat: ${spec.label}`);
      }
      return file;
    };

    for (const spec of files) {
      const file = await resolveFile(spec);

      if (total + file.sizeBytes > maxTotalBytes) {
        throw new Error(`context byte budget exceeded at "${spec.label}"`);
      }

      const u8 = bytesFromPrisma(file.data as Buffer | Uint8Array);
      total += u8.byteLength;

      const fileBlob: FileBlob = {
        name: file.filename,
        mediaType: file.mimeType as any,
        data: new Uint8Array(file.data), // adapt to your blob type
      };

      const { summary, previewText } = await normalizeForModel(fileBlob);

      out.push({
        label: spec.label,
        filename: file.filename,
        mediaType: file.mimeType,
        summary,
        data: previewText,
      });
    }

    return out;
  },
});
