"use server";

import { ChatSDKError } from "@/lib/errors";
import { Message, Prisma } from "@/lib/generated/prisma";
import prisma from "@/lib/prisma";

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    const result = await prisma.message.findMany({
      where: {
        chatId: id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return result;
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<Omit<Message, "createdAt" | "updatedAt">>;
}) {
  try {
    const result = await prisma.message.createMany({
      data: messages.map((msg) => ({
        ...msg,
        parts: msg.parts === null ? Prisma.JsonNull : msg.parts,
      })),
    });

    const chatUpdate = await prisma.chat.updateMany({
      where: {
        id: messages[0].chatId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}
