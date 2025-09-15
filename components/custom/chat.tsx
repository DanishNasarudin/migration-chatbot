"use client";
import { ChatSDKError } from "@/lib/errors";
import { useDataStream } from "@/lib/providers/data-stream-provider";
import { Attachment, ChatMessage } from "@/lib/types";
import { cn, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { toast } from "sonner";
import { unstable_serialize, useSWRConfig } from "swr";
import { MultimodalInput } from "./multimodal-input";

export default function Chat({
  id,
  initialMessages,
  selectedChatModel,
}: //   isReadonly,
//   autoResume,
{
  id: string;
  initialMessages: ChatMessage[];
  selectedChatModel: string;
  //   isReadonly: boolean;
  //   autoResume: boolean;
}) {
  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest({ messages, id, body }) {
        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      mutate(unstable_serialize("/api/history"));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        toast.error(error.message);
        console.log(`Error occured: ${error.message}`);
      }
    },
  });

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  return (
    <div>
      <form
        className={cn(
          "sticky bg-background bottom-0 mx-auto px-4 pb-8 pt-4 gap-2 w-full md:max-w-3xl"
        )}
      >
        <MultimodalInput
          chatId={id}
          input={input}
          setInput={setInput}
          status={status}
          stop={stop}
          attachments={attachments}
          setAttachments={setAttachments}
          messages={messages}
          setMessages={setMessages}
          sendMessage={sendMessage}
          selectedModelId={selectedChatModel}
          className="bg-background!"
        />
      </form>
    </div>
  );
}
