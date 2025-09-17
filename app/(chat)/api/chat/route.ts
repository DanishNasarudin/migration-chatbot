import { ChatModel, MODEL_REGISTRY, myProvider } from "@/lib/ai/models";
import { regularPrompt } from "@/lib/ai/prompts";
import { getChatFiles } from "@/lib/ai/tools/get-chat-files";
import { getMessageFile } from "@/lib/ai/tools/get-message-file";
import { isProductionEnvironment } from "@/lib/constants";
import { ChatSDKError } from "@/lib/errors";
import { Prisma } from "@/lib/generated/prisma";
import { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import {
  buildFileNudge,
  buildInlineFileNudge,
  generateTitleFromUserMessage,
  linkFilesToMessageAndChat,
} from "@/services/ai";
import { deleteChatById, getChatById, saveChat } from "@/services/chat";
import { getMessagesByChatId, saveMessages } from "@/services/message";
import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { NextRequest } from "next/server";
import { PostRequestBody, postRequestBodySchema } from "./schema";

export async function POST(request: NextRequest) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.log(`Zod Error: ${error}`);
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      userId,
    }: {
      id: string;
      message: ChatMessage;
      selectedChatModel: ChatModel["id"];
      userId: string;
    } = requestBody;

    if (!userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId,
        title,
      });
    } else {
      if (chat.userId !== userId) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
    }

    const haveTools = MODEL_REGISTRY.some(
      (m) => m.id === selectedChatModel && m.tools
    );
    const messagesFromDb = await getMessagesByChatId({ id });
    const fileNudge = await buildFileNudge(id, message.id);

    const makeFileRef = (a: any) =>
      [
        "[[FILE_REFERENCE]]",
        `contentType: ${a.mediaType}`,
        `chatId: ${id}`,
        `fileId: ${a.name}`,
        `messageId: ${message.id}`,
        "[[/FILE_REFERENCE]]",
      ].join("\n\n");

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: "user",
          parts: message.parts as Prisma.JsonValue,
        },
      ],
    });

    let fileIds: string[] = [];
    const messageNew: ChatMessage = {
      ...message,
      parts: message.parts.map((p) => {
        if (p.type === "file") {
          fileIds.push((p as any).name);
          return {
            type: "text",
            text: makeFileRef(p),
          };
        }
        return p;
      }),
    };

    if (fileIds.length > 0)
      await linkFilesToMessageAndChat({
        chatId: id,
        messageId: message.id,
        fileIds,
      });

    const nudge = await buildInlineFileNudge(id, message.id, {
      totalCharBudget: 16_000,
    });

    const uiMessages: ChatMessage[] = [
      ...convertToUIMessages(messagesFromDb),
      ...(!haveTools && nudge ? [nudge] : fileNudge ? [fileNudge] : []),
      messageNew,
    ];

    console.log("Feed_AI: ", uiMessages, haveTools);

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: regularPrompt,
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_activeTools: !haveTools
            ? []
            : ["getChatFiles", "getMessageFile"],
          // experimental_activeTools: ["getChatFiles", "getMessageFile"],
          experimental_transform: smoothStream({ chunking: "word" }),
          tools: {
            getChatFiles,
            getMessageFile,
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: ({ usage }) => {
            dataStream.write({ type: "data-usage", data: usage });
          },
        });

        result.consumeStream();

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts as Prisma.JsonValue,
            chatId: id,
          })),
        });
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
  } catch (error) {
    if (error instanceof ChatSDKError) {
      console.error("Chat error:", error);
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error);
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const userId = searchParams.get("userId");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== userId) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
