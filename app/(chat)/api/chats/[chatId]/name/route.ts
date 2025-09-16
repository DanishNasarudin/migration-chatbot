import { getChatById } from "@/services/chat";
import { NextRequest } from "next/server";

export type ChatNameDTO = { id: string; name: string | null };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await ctx.params;
  const chat = await getChatById({ id: chatId });

  if (!chat) {
    return Response.json({ id: "untitled", name: "untitled" });
  }
  return Response.json({ id: chat?.id, name: chat.title });
}
