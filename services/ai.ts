"use server";

import { myProvider } from "@/lib/ai/models";
import prisma from "@/lib/prisma";
import { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { generateText, UIMessage } from "ai";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel("small-model"),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function buildFileNudge(chatId: string, latestMessageId: string) {
  // 1) any files attached to THIS message?
  const messageFileRows = await prisma.messageFile.findMany({
    where: { messageId: latestMessageId },
    select: { datasetFileId: true },
  });

  // 2) any files accessible at CHAT scope?
  const chatFiles = await prisma.datasetFile.findMany({
    where: { chatLinks: { some: { chatId } } },
    select: { id: true, filename: true, mimeType: true },
  });

  const messageFileIds = messageFileRows.map((r) => r.datasetFileId);
  const hasFiles = messageFileIds.length > 0 || chatFiles.length > 0;

  if (!hasFiles) return null;

  // Prepare a concise step-by-step nudge including concrete IDs the model can use.
  const lines: string[] = [];

  if (messageFileIds.length > 0) {
    lines.push(
      `First, call getMessageFile for each file attached to the latest user message.`,
      `Use: { chatId: "${chatId}", messageId: "${latestMessageId}", fileId }`,
      `Available message fileIds: ${messageFileIds
        .map((id) => `"${id}"`)
        .join(", ")}`
    );
  }

  if (chatFiles.length > 0) {
    const labelPairs = chatFiles.map((f, i) => ({
      label: `file_${i + 1}`,
      fileId: f.id,
    }));
    lines.push(
      `Then call getChatFiles to load any chat-level documents you need.`,
      `Use: { chatId: "${chatId}", files: [${labelPairs
        .map((p) => `{ label: "${p.label}", fileId: "${p.fileId}" }`)
        .join(", ")}] }`
    );
  }

  lines.push(
    `After loading, answer the user's request using the file contents.`
  );

  const nudge: ChatMessage = {
    id: generateUUID(),
    role: "system",
    parts: [{ type: "text", text: lines.join("\n") }],
    metadata: { createdAt: new Date().toISOString() },
  };

  return nudge;
}
