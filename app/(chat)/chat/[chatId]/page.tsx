import Chat from "@/components/custom/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { getChatById } from "@/services/chat";
import { getMessagesByChatId } from "@/services/message";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const chat = await getChatById({ id: chatId });

  if (!chat) {
    redirect("/chat");
  }

  const messagesFromDb = await getMessagesByChatId({
    id: chatId,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");
  const userId = cookieStore.get("app_uid")?.value ?? generateUUID();

  if (!chatModelFromCookie) {
    return (
      <Chat
        id={chatId}
        initialMessages={uiMessages}
        selectedChatModel={DEFAULT_CHAT_MODEL}
        userId={userId}
      />
    );
  }

  return (
    <Chat
      id={chatId}
      initialMessages={uiMessages}
      selectedChatModel={chatModelFromCookie.value}
      userId={userId}
    />
  );
}
