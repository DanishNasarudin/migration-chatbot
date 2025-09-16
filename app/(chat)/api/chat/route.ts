import { isProductionEnvironment } from "@/lib/constants";
import { ChatSDKError } from "@/lib/errors";
import { Prisma } from "@/lib/generated/prisma";
import { ChatModel, myProvider } from "@/lib/models";
import { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "@/services/ai";
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
  } catch (_) {
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

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

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

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          //   system: systemPrompt({ selectedChatModel, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          //   experimental_activeTools:
          //     selectedChatModel === "chat-model-reasoning"
          //       ? []
          //       : [
          //           "getWeather",
          //           "createDocument",
          //           "updateDocument",
          //           "requestSuggestions",
          //         ],
          experimental_transform: smoothStream({ chunking: "word" }),
          //   tools: {
          //     getWeather,
          //     createDocument: createDocument({ session, dataStream }),
          //     updateDocument: updateDocument({ session, dataStream }),
          //     requestSuggestions: requestSuggestions({
          //       session,
          //       dataStream,
          //     }),
          //   },
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
