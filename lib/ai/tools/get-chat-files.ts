import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod/v3";
import { bytesFromPrisma } from "../helper";

const FileSpec = z
  .object({
    label: z.string(), // e.g. "previousFile", "reference", "schema"
    fileId: z.string().optional(),
  })
  .refine((v) => v.fileId, { message: "fileId required" });

export const getChatFiles = tool({
  description:
    "Load multiple labeled files that are available to this chat (e.g. previousFile, schema, goldTruth).",
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
    // resolve chat & owner
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { userId: true },
    });
    if (!chat) throw new Error("chat not found");

    const out: Array<{
      label: string;
      filename: string;
      mediaType: string;
      data: Uint8Array;
    }> = [];
    let total = 0;

    for (const spec of files) {
      const file = await prisma.datasetFile.findFirst({
        where: { id: spec.fileId },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          data: true,
          chatLinks: { where: { chatId }, select: { chatId: true } }, // chat-level access
        },
      });
      if (!file || file.chatLinks.length === 0) {
        // skip silently or throw; here we throw so the model learns what failed
        throw new Error(`file not accessible to chat: ${spec.label}`);
      }

      if (total + file.sizeBytes > maxTotalBytes) {
        throw new Error(`context byte budget exceeded at "${spec.label}"`);
      }
      const u8 = bytesFromPrisma(file.data as Buffer | Uint8Array);
      total += u8.byteLength;

      out.push({
        label: spec.label,
        filename: file.filename,
        mediaType: file.mimeType,
        data: u8,
      });
    }
    return out;
  },
});
