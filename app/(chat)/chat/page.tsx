import Chat from "@/components/custom/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";
import { cookies } from "next/headers";

export default async function Page() {
  const id = generateUUID();

  const cookieStore = await cookies();
  const chatModelFromCookie =
    cookieStore.get("chat-model")?.value ?? "qwen3:8b";
  const userId = cookieStore.get("app_uid")?.value ?? generateUUID();

  if (!chatModelFromCookie) {
    return (
      <Chat
        id={id}
        initialMessages={[]}
        selectedChatModel={DEFAULT_CHAT_MODEL}
        userId={userId}
      />
    );
  }

  return (
    <Chat
      id={id}
      initialMessages={[]}
      selectedChatModel={chatModelFromCookie}
      userId={userId}
    />
  );
}
