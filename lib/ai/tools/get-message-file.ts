import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod/v3";
import { bytesFromPrisma } from "../helper";

export const getMessageFile = tool({
  description: "Return the bytes of the file attached to the given message.",
  inputSchema: z
    .object({
      chatId: z.string(),
      messageId: z.string(),
      fileId: z.string().optional(),
    })
    .refine((v) => v.fileId, { message: "fileId or checksum required" }),

  async execute({ chatId, messageId, fileId }) {
    // Resolve message & owner
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { chatId: true, chat: { select: { userId: true } } },
    });
    if (!msg || msg.chatId !== chatId)
      throw new Error("message not found in chat");

    // Find the file (must exist first)
    const file = await prisma.datasetFile.findFirst({
      where: { id: fileId },
      select: { id: true, filename: true, mimeType: true, data: true },
    });
    if (!file) throw new Error("file not found");

    // Strict auth: only if attached to THIS message
    const linked = await prisma.messageFile.findFirst({
      where: { messageId, datasetFileId: file.id },
      select: { id: true },
    });
    if (!linked) throw new Error("file not attached to this message");

    const u8 = bytesFromPrisma(file.data as Buffer | Uint8Array);
    return { filename: file.filename, mediaType: file.mimeType, data: u8 };
  },
});
