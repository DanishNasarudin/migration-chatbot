"use client";

import { useDataStream } from "@/lib/providers/data-stream-provider";
import { cn, sanitizeText } from "@/lib/utils";
import { ChatMessage } from "@/types/ai";
import { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { BotMessageSquareIcon } from "lucide-react";
import { memo } from "react";
import { Streamdown } from "streamdown";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { MessageReasoning } from "./message-reasoning";

type MessageProps = {
  chatId: string;
  message: ChatMessage;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
};

function PureMessage({ isLoading, message }: MessageProps) {
  useDataStream();

  return (
    <div
      className={cn(
        "flex gap-4 w-full max-w-[700px] mx-auto",
        message.role === "assistant" ? "justify-start" : "justify-end"
      )}
    >
      <div className="w-[40px] flex-none">
        {message.role === "assistant" && (
          <Avatar className="w-[36px] h-[36px]">
            <AvatarFallback>
              <BotMessageSquareIcon />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div
        className={cn(
          "text-xs p-2 flex flex-col gap-2 justify-center w-full text-wrap",
          message.role === "user" &&
            "bg-secondary rounded-xl max-w-[60%] px-6 py-4"
        )}
      >
        {message.parts?.map((part, index) => {
          const { type } = part;
          const key = `message-${message.id}-part-${index}`;

          if (type === "reasoning" && part.text?.trim().length > 0) {
            return (
              <MessageReasoning
                key={key}
                isLoading={isLoading}
                reasoning={part.text}
              />
            );
          }
          if (type === "text") {
            // TODO: with regenerate and mode view/edit
            return (
              <div key={key}>
                <Streamdown
                  className={cn(
                    "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto"
                  )}
                >
                  {sanitizeText(part.text)}
                </Streamdown>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

export const Message = memo(PureMessage, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.message.id !== nextProps.message.id) return false;
  if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

  return false;
});
