import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { createOllama } from "ollama-ai-provider-v2";

const API_URL =
  process.env.OLLAMA_API_URL || "http://host.docker.internal:11434/api";

export const ollama = createOllama({
  baseURL: API_URL,
});

type RegistryItem = {
  id: string;
  providerId: string;
  name: string;
  description: string;
  showInPicker: boolean;
  tools: boolean;
  reasoning?: boolean;
};

export const MODEL_REGISTRY = [
  {
    id: "llama3.2:3b",
    providerId: "llama3.2:3b",
    name: "Small (Llama 3.2 • 3B)",
    description: "≈2.0GB • 128K ctx",
    tools: false,
    reasoning: false,
    showInPicker: true,
  },
  {
    id: "qwen3:8b",
    providerId: "qwen3:8b",
    name: "Qwen3 8B",
    description: "≈5.2GB • 40K ctx",
    tools: true,
    reasoning: false,
    showInPicker: true,
  },
  {
    id: "qwen3:14b",
    providerId: "qwen3:14b",
    name: "Qwen3 14B",
    description: "≈9.3GB • 40K ctx",
    tools: true,
    reasoning: false,
    showInPicker: true,
  },
  {
    id: "deepseek-r1:8b",
    providerId: "deepseek-r1:8b",
    name: "DeepSeek R1 8B (reasoning)",
    description: "≈5.2GB • 128K ctx",
    tools: false,
    reasoning: true,
    showInPicker: true,
  },
  {
    id: "deepseek-r1:14b",
    providerId: "deepseek-r1:14b",
    name: "DeepSeek R1 14B (reasoning)",
    description: "≈9.0GB • 128K ctx",
    tools: false,
    reasoning: true,
    showInPicker: true,
  },
  {
    id: "gemma3:4b",
    providerId: "gemma3:4b",
    name: "Gemma 3 • 4B",
    description: "≈3.3GB • 128K ctx",
    tools: false,
    reasoning: false,
    showInPicker: true,
  },
  {
    id: "gemma3:12b",
    providerId: "gemma3:12b",
    name: "Gemma 3 • 12B",
    description: "≈8.1GB • 128K ctx",
    tools: false,
    reasoning: false,
    showInPicker: true,
  },
  {
    id: "gpt-oss:20b",
    providerId: "gpt-oss:20b",
    name: "GPT-OSS 20B (reasoning)",
    description: "≈14GB • 128K ctx",
    tools: true,
    reasoning: true,
    showInPicker: true,
  },
  {
    id: "phi3:mini",
    providerId: "phi3:mini",
    name: "Phi-3 Mini",
    description: "≈2.2GB • 128K ctx",
    tools: false,
    reasoning: false,
    showInPicker: true,
  },
  {
    id: "phi3:medium",
    providerId: "phi3:medium",
    name: "Phi-3 Medium",
    description: "≈7.9GB • 128K ctx",
    tools: false,
    reasoning: false,
    showInPicker: true,
  },
] as const satisfies readonly RegistryItem[];

export type ModelId = (typeof MODEL_REGISTRY)[number]["id"];

export const MUTABLE_REGISTRY: RegistryItem[] = MODEL_REGISTRY.map((r) => ({
  ...r,
}));

const languageModels = (() => {
  const out = {} as Record<ModelId, LanguageModelV2>;
  for (const item of MODEL_REGISTRY as readonly RegistryItem[]) {
    const base = ollama(item.providerId);
    out[item.id as ModelId] = item.reasoning
      ? wrapLanguageModel({
          model: base,
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        })
      : base;
  }
  return out;
})();

export const myProvider = customProvider({
  languageModels,
  // If you need embeddings elsewhere, expose one (see note below):
  textEmbeddingModels: {
    "embedding-model": ollama.textEmbeddingModel(
      "avr/sfr-embedding-mistral:latest"
    ),
  },
});

export const DEFAULT_CHAT_MODEL: ModelId =
  (process.env.OLLAMA_CHAT_MODEL as ModelId) ?? "deepseek-r1:7b";

export const DEFAULT_TITLE_MODEL: ModelId =
  (process.env.OLLAMA_TITLE_MODEL as ModelId) ?? "small-model";

export interface ChatModel {
  id: ModelId;
  name: string;
  description: string;
}

export const chatModels: ChatModel[] = MODEL_REGISTRY.filter(
  (m) => m.showInPicker
).map(({ id, name, description }) => ({ id, name, description }));

export const CHAT_MODEL_IDS = MODEL_REGISTRY.map((m) => m.id) as [
  ModelId,
  ...ModelId[]
];

export type ChatModelId = ModelId;

// export const CHAT_MODEL_IDS = [
//   "small-model", // llama3.2:3b 2.0GB - 128K ctx
//   "qwen3:8b", // 5.2GB - 40K ctx
//   "qwen3:14b", // 9.3GB - 40K ctx
//   "deepseek-r1:8b", // 5.2GB reasoning - 128K ctx
//   "deepseek-r1:14b", // 9GB reasoning - 128K ctx
//   "gemma3:4b", // 3.3GB - 128K ctx
//   "gemma3:12b", // 8.1GB - 128K ctx
//   "gpt-oss:20b", // 14GB reasoning - 128K ctx
//   "phi3:mini", // 8b 2.2GB - 128K ctx
//   "phi3:medium", // 14b 7.9GB - 128K ctx
// ] as const;
