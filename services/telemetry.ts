"use server";

import prisma from "@/lib/prisma";

type Telemetry = {
  modelId: string;
  tag?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationClientMs: number; // same as end-to-end for server paths
  durationServerMs?: number;
  ttftMs?: number;
  stopped?: boolean;
  disconnected?: boolean;
  error?: boolean;
  // tie back to experiment/trial without polluting chat:
  chatId: string; // e.g. `exp:${experimentId}`
  userMessageId: string; // e.g. `trial:${trialId}`
  assistantMessageId?: string;
};

export async function writeModelRun(m: Telemetry) {
  await prisma.modelRun.create({
    data: {
      chatId: m.chatId,
      userMessageId: m.userMessageId,
      assistantMessageId: m.assistantMessageId ?? null,
      modelId: m.modelId,
      tag: m.tag ?? null,
      inputTokens: m.inputTokens ?? null,
      outputTokens: m.outputTokens ?? null,
      totalTokens: m.totalTokens ?? null,
      durationClientMs: m.durationClientMs,
      durationServerMs: m.durationServerMs ?? null,
      ttftMs: m.ttftMs ?? null,
      stopped: !!m.stopped,
      disconnected: !!m.disconnected,
      error: !!m.error,
      createdAt: new Date(),
    },
  });
}
