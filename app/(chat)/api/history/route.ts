import { getChatsByUserId } from "@/services/chat";
import { cookies } from "next/headers";

export async function GET() {
  const cookie = await cookies();
  const userId = cookie.get("app_uid")?.value ?? null;
  const chats = userId ? await getChatsByUserId({ userId }) : [];

  return Response.json(chats);
}
