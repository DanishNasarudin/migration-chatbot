import { InferUITool, LanguageModelUsage, UIMessage } from "ai";
import z from "zod/v3";
import { getChatFiles } from "./ai/tools/get-chat-files";
import { getMessageFile } from "./ai/tools/get-message-file";

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
  model: z.string().optional(),
  totalTokens: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  serverDurationMs: z.number().optional(),
  serverStartedAt: z.number().optional(),
  finishedAt: z.number().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type getMessageFileTool = InferUITool<typeof getMessageFile>;
type getChatFilesTool = InferUITool<typeof getChatFiles>;

export type ChatTools = {
  getMessageFile: getMessageFileTool;
  getChatFiles: getChatFilesTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  //   suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  //   kind: ArtifactKind;
  clear: null;
  finish: null;
  dataUsage: string;
  usage: LanguageModelUsage;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
  id: string;
}
