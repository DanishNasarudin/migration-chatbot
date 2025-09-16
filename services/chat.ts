"use server";

import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getChatsByUserId({ userId }: { userId: string }) {
  try {
    const result = await prisma.chat.findMany({
      where: {
        userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return result;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chats");
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const result = await prisma.chat.findUnique({
      where: { id },
    });

    if (!result) {
      return null;
    }

    return result;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    const result = await prisma.chat.create({
      data: {
        id,
        userId,
        title,
      },
    });

    revalidatePath("/chat");

    return result;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    const result = await prisma.chat.delete({
      where: {
        id,
      },
    });

    return result;
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}
