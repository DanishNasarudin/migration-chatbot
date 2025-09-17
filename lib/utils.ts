import { UIMessagePart } from "ai";
import { clsx, type ClassValue } from "clsx";
import { formatISO } from "date-fns";
import { twMerge } from "tailwind-merge";
import { ChatSDKError, ErrorCode } from "./errors";
import { Message } from "./generated/prisma";
import { ChatMessage, ChatTools, CustomUIDataTypes } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async <T>(
  url: string,
  cache: boolean = true
): Promise<T> => {
  const caching = cache ? undefined : ({ cache: "no-store" } as RequestInit);
  const r = await fetch(url, caching);
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
};

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new ChatSDKError("offline:chat");
    }

    throw error;
  }
}

export function sanitizeText(text: string) {
  return text.replace("<has_function_call>", "");
}

export function convertToUIMessages(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: (
      message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[]
    ).filter((p) => {
      if (p.type !== "file") {
        return p;
      }
    }),
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

type ModelRunMetric = {
  chatId: string;
  userMessageId: string;
  assistantMessageId?: string;
  modelId: string;
  tag?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationClientMs: number;
  ttftMs?: number;
  durationServerMs?: number;
  stopped?: boolean;
  disconnected?: boolean;
  error?: boolean;
  createdAt: string;
};

export async function postMetrics(m: ModelRunMetric) {
  await fetch("/api/metrics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(m),
  });
}
