import { useMessages } from "@/lib/hooks/use-messages";
import { useDataStream } from "@/lib/providers/data-stream-provider";
import { ChatMessage } from "@/lib/types";
import { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDownIcon } from "lucide-react";
import { memo, useEffect } from "react";
import { Conversation, ConversationContent } from "../ui/conversation";
import { Greeting } from "./greeting";
import { Message } from "./message";

function PureMessages({
  chatId,
  status,
  messages,
  setMessages,
  regenerate,
  //   isReadonly,
  selectedModelId,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  //   isReadonly: boolean;
  selectedModelId: string;
}) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    hasSentMessage,
  } = useMessages({
    chatId,
    status,
  });

  useDataStream();

  useEffect(() => {
    if (status === "submitted") {
      requestAnimationFrame(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [status, messagesContainerRef]);

  return (
    <div
      ref={messagesContainerRef}
      className="w-full h-full mx-auto gap-2 overflow-y-auto relative"
      style={{ overflowAnchor: "none" }}
    >
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 md:gap-6">
        <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
          {messages.length === 0 && <Greeting />}
          {messages.map((message, index) => (
            <Message
              key={message.id}
              chatId={chatId}
              message={message}
              isLoading={
                status === "streaming" && messages.length - 1 === index
              }
              setMessages={setMessages}
              regenerate={regenerate}
            />
          ))}
          <div
            ref={messagesEndRef}
            className="min-h-[24px] min-w-[24px] shrink-0"
          />
        </ConversationContent>
      </Conversation>

      {!isAtBottom && (
        <button
          className="-translate-x-1/2 absolute bottom-40 left-1/2 z-10 rounded-full border bg-background p-2 shadow-lg transition-colors hover:bg-muted"
          onClick={() => scrollToBottom("smooth")}
          type="button"
          aria-label="Scroll to bottom"
        >
          <ArrowDownIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

export const Messages = memo(PureMessages);
