import z from "zod/v3";

export const metricSchema = z.object({
  chatId: z.string(),
  userMessageId: z.string(),
  assistantMessageId: z.string().optional(),
  modelId: z.string(),
  tag: z.string().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  durationClientMs: z.number().int(),
  ttftMs: z.number().int().optional(),
  durationServerMs: z.number().int().optional(),
  stopped: z.boolean().optional(),
  disconnected: z.boolean().optional(),
  error: z.boolean().optional(),
  createdAt: z.string(),
});

export type PostRequestBody = z.infer<typeof metricSchema>;
