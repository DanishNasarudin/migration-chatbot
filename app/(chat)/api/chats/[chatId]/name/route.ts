import { chatsMock } from "@/lib/mock";
import { NextRequest, NextResponse } from "next/server";

export type ChatNameDTO = { id: string; name: string | null };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await ctx.params;
  const chat = chatsMock.find((c) => c.id === chatId);

  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json<ChatNameDTO>(chat);
}
