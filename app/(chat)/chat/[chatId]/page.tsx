import Chat from "@/components/custom/chat";
import { mockChatMessages } from "@/lib/mock";
import { DEFAULT_CHAT_MODEL } from "@/lib/models";
import { cookies } from "next/headers";

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <Chat
        id={chatId}
        initialMessages={mockChatMessages.filter((i) => i.role !== "system")}
        selectedChatModel={DEFAULT_CHAT_MODEL}
      />
    );
  }

  return (
    <Chat
      id={chatId}
      initialMessages={[]}
      selectedChatModel={chatModelFromCookie.value}
    />
  );
}
