import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod/v3";
import { FileBlob, normalizeForModel } from "../helper";

export const getMessageFile = tool({
  description:
    "Return the bytes of the file attached to the given message. Use when have [[FILE_REFERENCE]]",
  inputSchema: z
    .object({
      chatId: z.string(),
      messageId: z.string(),
      fileId: z.string().optional(),
    })
    .refine((v) => v.fileId, { message: "fileId or checksum required" }),

  async execute({ chatId, messageId, fileId }) {
    console.log("ai-tool: getMessageFile called");
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true },
    });
    if (!chat) throw new Error("chat not found");

    // Resolve a candidate DatasetFile scoped by ownership or chat link
    const whereByIdentifier = { id: fileId };

    // Prefer files owned by this user or linked to this chat
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
      },
    });
    if (!file) throw new Error("file not found or not accessible to this chat");

    // Access is allowed if attached to this message OR to this chat OR same owner
    const [attachedToMessage, linkedToChat] = await Promise.all([
      prisma.messageFile.findFirst({
        where: { messageId, datasetFileId: file.id },
        select: { id: true },
      }),
      prisma.chatFile.findFirst({
        where: { chatId, datasetFileId: file.id },
        select: { chatId: true },
      }),
    ]);

    if (!attachedToMessage && !linkedToChat) {
      throw new Error(
        "file not attached to this message/chat or owned by user"
      );
    }

    const fileBlob: FileBlob = {
      name: file.filename,
      mediaType: file.mimeType as any,
      data: new Uint8Array(file.data), // adapt to your blob type
    };

    const { summary, previewText } = await normalizeForModel(fileBlob);
    console.log(previewText, "BROOO");
    return {
      filename: file.filename,
      mediaType: file.mimeType,
      summary,
      data: previewText,
    };
  },
});
