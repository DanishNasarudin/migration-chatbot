"use client";
import { ChatSDKError } from "@/lib/errors";
import { useDataStream } from "@/lib/providers/data-stream-provider";
import {
  cn,
  fetchWithErrorHandlers,
  generateUUID,
  postMetrics,
} from "@/lib/utils";
import { Attachment, ChatMessage } from "@/types/ai";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { unstable_serialize, useSWRConfig } from "swr";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

export default function Chat({
  id,
  initialMessages,
  selectedChatModel,
  userId,
}: //   isReadonly,
//   autoResume,
{
  id: string;
  initialMessages: ChatMessage[];
  selectedChatModel: string;
  userId: string;
  //   isReadonly: boolean;
  //   autoResume: boolean;
}) {
  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const runTimesRef = useRef<
    Record<string, { start: number; firstToken?: number }>
  >({});
  const currentUserMsgIdRef = useRef<string | null>(null);

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
        const userMsg = messages.at(-1);
        if (userMsg) {
          runTimesRef.current[userMsg.id] = { start: performance.now() };
          currentUserMsgIdRef.current = userMsg.id;
        }
        return {
          body: {
            id,
            message: userMsg,
            selectedChatModel,
            userId,
            ...body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      const uid = currentUserMsgIdRef.current;
      if (uid && !runTimesRef.current[uid]?.firstToken) {
        // first server-sent event → TTFT
        runTimesRef.current[uid].firstToken = performance.now();
      }
      console.log("client onData: ", dataPart);
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      mutate(unstable_serialize("/api/history"));
      const userMsgId = currentUserMsgIdRef.current;
      const start = userMsgId
        ? runTimesRef.current[userMsgId]?.start
        : undefined;
      const first = userMsgId
        ? runTimesRef.current[userMsgId]?.firstToken
        : undefined;
      const end = performance.now();
      const durationClientMs = start ? Math.round(end - start) : 0;
      const ttftMs = start && first ? Math.round(first - start) : undefined;

      // Expect these from message.metadata (we’ll attach them server-side)
      const meta = (message?.metadata ?? {}) as Partial<{
        model: string;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        serverDurationMs: number;
      }>;

      void postMetrics({
        chatId: id,
        userMessageId: userMsgId ?? "",
        assistantMessageId: message?.id,
        modelId: meta.model ?? selectedChatModel,
        inputTokens: meta.inputTokens,
        outputTokens: meta.outputTokens,
        totalTokens: meta.totalTokens,
        durationClientMs,
        ttftMs,
        durationServerMs: meta.serverDurationMs,
        stopped: Boolean(isAbort),
        disconnected: Boolean(isDisconnect),
        error: Boolean(isError),
        createdAt: new Date().toISOString(),
      });
    },
    onError: (error) => {
      const uid = currentUserMsgIdRef.current;
      if (uid) {
        const start = runTimesRef.current[uid]?.start;
        const end = performance.now();
        if (start) {
          void postMetrics({
            chatId: id,
            userMessageId: uid,
            modelId: selectedChatModel,
            durationClientMs: Math.round(end - start),
            stopped: true,
            createdAt: new Date().toISOString(),
          });
        }
      }
      if (error instanceof ChatSDKError) {
        toast.error(error.message);
        console.log(`Error occured: ${error.message}`);
      }
    },
  });

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  return (
    <>
      <Messages
        chatId={id}
        status={status}
        messages={messages}
        setMessages={setMessages}
        regenerate={regenerate}
        selectedModelId={selectedChatModel}
      />
      <form
        className={cn(
          "sticky bg-background bottom-0 mx-auto p-4 gap-2 w-full md:max-w-3xl"
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
    </>
  );
}
