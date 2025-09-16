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

export const DEFAULT_CHAT_MODEL: string =
  process.env.OLLAMA_CHAT_MODEL || "deepseek-r1:7b";

export const myProvider = customProvider({
  languageModels: {
    "deepseek-r1:7b": wrapLanguageModel({
      model: ollama("deepseek-r1:7b"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "deepseek-r1:70b": wrapLanguageModel({
      model: ollama("deepseek-r1:70b"),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    }),
    "llama3.3:latest": ollama("llama3.3:latest"),
    mistral: ollama("mistral"),
    "qwen2.5:7b": ollama("qwen2.5:7b"), // 4.7gb
    "qwen2.5:14b": ollama("qwen2.5:14b"), // 9gb
    "qwen2.5:32b": ollama("qwen2.5:32b"), // 19gb
    "qwen2.5:72b": ollama("qwen2.5:72b"),
    "small-model": ollama("llama3.2:latest"),
    "llama3.2-object": ollama("llama3.2:latest"),
    openhermes: ollama("openhermes"),
    "openhermes-object": ollama("openhermes"),
    "gemma3:4b": ollama("gemma3:4b"), // 3.3gb
    "qwen3:8b": ollama("qwen3:8b"), // 5.2gb
  },
  textEmbeddingModels: {
    "embedding-model": ollama.textEmbeddingModel(
      "avr/sfr-embedding-mistral:latest"
    ),
  },
});

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: "small-model",
    name: "Small model (llama3.2)",
    description: "Small model for fast task",
  },
  // {
  //   id: "deepseek-r1:7b",
  //   name: "Small model (deepseek-r1:7b)",
  //   description: "Small model for fast reasoning",
  // },
  // {
  //   id: "deepseek-r1:70b",
  //   name: "Large model (deepseek-r1:70b)",
  //   description: "Large model for complex reasoning",
  // },
  {
    id: "qwen2.5:14b",
    name: "Small model (qwen2.5:14b)",
    description: "Small model for fast task",
  },
  {
    id: "qwen2.5:32b",
    name: "Medium model (qwen2.5:32b)",
    description: "Medium model for fast task (The BEST right now)",
  },
  // {
  //   id: "qwen2.5:72b",
  //   name: "Large model (qwen2.5:72b)",
  //   description: "Large model for complex reasoning",
  // },
  // {
  //   id: "openhermes",
  //   name: "Small model (openhermes)",
  //   description: "Small model for fast task",
  // },
  // {
  //   id: "mistral",
  //   name: "Small model (mistral)",
  //   description: "Small model for fast task",
  // },
  {
    id: "llama3.3:latest",
    name: "Large model (llama3.3:latest)",
    description: "Large model for complex task",
  },
];
