"use server";

import { FileBlob, normalizeForModel } from "@/lib/ai/helper";
import { DEFAULT_TITLE_MODEL, myProvider } from "@/lib/ai/models";
import prisma from "@/lib/prisma";
import { generateUUID, systemMessage } from "@/lib/utils";
import { ChatMessage } from "@/types/ai";
import { generateText, UIMessage } from "ai";
import { cookies } from "next/headers";

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel(DEFAULT_TITLE_MODEL),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function buildFileNudge(chatId: string, latestMessageId: string) {
  // 1) any files attached to THIS message?
  const messageFileRows = await prisma.messageFile.findMany({
    where: { messageId: latestMessageId },
    select: { datasetFileId: true },
  });

  // 2) any files accessible at CHAT scope?
  const chatFiles = await prisma.datasetFile.findMany({
    where: { chatLinks: { some: { chatId } } },
    select: { id: true, filename: true, mimeType: true },
  });

  const messageFileIds = messageFileRows.map((r) => r.datasetFileId);
  const hasFiles = messageFileIds.length > 0 || chatFiles.length > 0;

  if (!hasFiles) return null;

  // Prepare a concise step-by-step nudge including concrete IDs the model can use.
  const lines: string[] = [];

  if (messageFileIds.length > 0) {
    lines.push(
      `First, call getMessageFile for each file attached to the latest user message.`,
      `Use: { chatId: "${chatId}", messageId: "${latestMessageId}", fileId }`,
      `Available message fileIds: ${messageFileIds
        .map((id) => `"${id}"`)
        .join(", ")}`
    );
  }

  if (chatFiles.length > 0) {
    const labelPairs = chatFiles.map((f, i) => ({
      label: `file_${i + 1}`,
      fileId: f.id,
    }));
    lines.push(
      `Then call getChatFiles to load any chat-level documents you need.`,
      `Use: { chatId: "${chatId}", files: [${labelPairs
        .map((p) => `{ label: "${p.label}", fileId: "${p.fileId}" }`)
        .join(", ")}] }`
    );
  }

  lines.push(
    `After loading, answer the user's request using the file contents.`
  );

  const nudge: ChatMessage = {
    id: generateUUID(),
    role: "system",
    parts: [{ type: "text", text: lines.join("\n") }],
    metadata: { createdAt: new Date().toISOString() },
  };

  return nudge;
}

export async function linkFilesToMessageAndChat(params: {
  chatId: string;
  messageId: string;
  fileIds: string[];
}) {
  const { chatId, messageId, fileIds } = params;
  if (!fileIds.length) return;

  // Only link files that actually exist
  const existing = await prisma.datasetFile.findMany({
    where: { id: { in: fileIds } },
    select: { id: true },
  });
  if (!existing.length) return;

  await Promise.all(
    existing.flatMap((f) => [
      prisma.chatFile.upsert({
        where: { chatId_fileId: { chatId, datasetFileId: f.id } },
        create: { chatId, datasetFileId: f.id },
        update: {},
      }),
      prisma.messageFile.upsert({
        where: { messageId_fileId: { messageId, datasetFileId: f.id } },
        create: { messageId, datasetFileId: f.id },
        update: {},
      }),
    ])
  );
}

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export type InlineFileNudgeOptions = {
  /** Hard cap for all inlined text (characters). Default: 12000 */
  totalCharBudget?: number;
  /** Per-file minimum slice before proportional allocation. Default: 1200 */
  perFileMinChars?: number;
  /** Include a brief header with file list. Default: true */
  includeHeader?: boolean;
  /** Optional: label prefix for sections. Default: "file" → file_1, file_2, ... */
  labelPrefix?: string;
};

export type ResolvedFileText = {
  fileId: string;
  filename: string;
  mimeType: string;
  /** UTF-8 text extracted from the file (already converted from CSV/XLSX/JSON/PDF, etc.) */
  text?: string | null;
  /** Optional size metadata for display */
  sizeBytes?: number | null;
};

/**
 * Build a single system message that inlines excerpts from any files attached to the latest message
 * and/or linked at the chat level — for models that cannot call tools or accept `file` parts.
 *
 * Provide `resolveFileText` to obtain UTF-8 text for each fileId (reusing your existing extractors).
 */
export async function buildInlineFileNudge(
  chatId: string,
  latestMessageId: string,
  opts: InlineFileNudgeOptions = {}
): Promise<ChatMessage | null> {
  const {
    totalCharBudget = 12_000,
    perFileMinChars = 1_200,
    includeHeader = true,
    labelPrefix = "file",
  } = opts;

  // 1) Files attached to THIS message
  const messageFileRows = await prisma.messageFile.findMany({
    where: { messageId: latestMessageId },
    select: { datasetFileId: true },
  });

  // 2) Files available at CHAT scope
  const chatFiles = await prisma.datasetFile.findMany({
    where: { chatLinks: { some: { chatId } } },
    select: { id: true, filename: true, mimeType: true },
  });

  const messageFileIds = messageFileRows.map((r) => r.datasetFileId);
  const chatFileIds = chatFiles.map((f) => f.id);

  const uniqueIds = dedupe([...messageFileIds, ...chatFileIds]);
  if (uniqueIds.length === 0) return null;

  // 3) Resolve file texts (you plug your extractor here)
  const resolved = await Promise.all(
    uniqueIds.map((id) => resolveFileText(id))
  );

  // Attach known filename/mime from chatFiles list if resolveFileText didn't
  const byIdMeta = new Map(chatFiles.map((f) => [f.id, f]));
  const files: ResolvedFileText[] = resolved.map((r) => {
    const meta = byIdMeta.get(r.fileId);
    return {
      fileId: r.fileId,
      filename: r.filename ?? meta?.filename ?? r.fileId,
      mimeType: r.mimeType ?? meta?.mimeType ?? "application/octet-stream",
      text: r.text ?? null,
      sizeBytes: r.sizeBytes ?? null,
    };
  });

  // 4) Budgeting: fair slice for each file, then proportional by content length
  const textable = files.filter((f) => (f.text?.length ?? 0) > 0);
  const nontext = files.filter((f) => !f.text);
  if (textable.length === 0) {
    // Nothing to inline; still helpful to list files for the model's awareness.
    const header = renderHeader(
      includeHeader,
      files,
      messageFileIds,
      chatFileIds
    );
    return systemMessage(
      header + "\n(No extractable text available from the attached files.)"
    );
  }

  const baseBudget = Math.max(4000, totalCharBudget); // guard against too-low totals
  const perFileMin = Math.min(
    Math.floor(baseBudget / Math.max(1, textable.length)),
    perFileMinChars
  );
  const remaining = Math.max(0, baseBudget - perFileMin * textable.length);

  const lengths = textable.map((f) => f.text!.length);
  const totalLen = lengths.reduce((a, b) => a + b, 0) || 1;
  const proportional = lengths.map((len) =>
    Math.floor((len / totalLen) * remaining)
  );

  // 5) Compose message text
  const lines: string[] = [];

  // Header (file list + usage guidance)
  lines.push(
    renderHeader(includeHeader, files, messageFileIds, chatFileIds),
    "You cannot call tools. Use only the inlined context below.",
    "If something is missing, say so clearly."
  );

  // 6) Per-file sections with delimiters and light formatting
  let idx = 0;
  for (const f of textable) {
    const sliceBudget = perFileMin + proportional[idx++];
    const excerpt = renderExcerpt(f, sliceBudget);
    const label = `${labelPrefix}_${idx}`;
    lines.push(
      `\n===== BEGIN ${label} — ${f.filename} (${f.mimeType}) — id:${f.fileId} =====`,
      excerpt,
      `===== END ${label} — ${f.filename} =====`
    );
  }

  // Mention non-text files so the model knows they exist
  if (nontext.length > 0) {
    lines.push(
      "\n(Non-text/binary files present but not inlined:",
      ...nontext.map(
        (f) =>
          `- ${f.filename} (${f.mimeType}) id:${f.fileId}${
            f.sizeBytes ? ` • ${formatBytes(f.sizeBytes)}` : ""
          }`
      ),
      ")"
    );
  }

  // Closing instruction
  lines.push(
    "\nAnswer the user's request using only the provided excerpts above. If crucial details are missing, ask for a follow-up or a larger excerpt."
  );

  return systemMessage(lines.join("\n"));
}

/* ----------------------- helpers ----------------------- */

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function renderHeader(
  includeHeader: boolean,
  files: ResolvedFileText[],
  messageFileIds: string[],
  chatFileIds: string[]
): string {
  if (!includeHeader) return "";
  const header: string[] = [];
  header.push("### Inlined File Context (no tools)");
  if (messageFileIds.length)
    header.push(`Message-scoped fileIds: ${messageFileIds.join(", ")}`);
  if (chatFileIds.length)
    header.push(`Chat-scoped fileIds: ${chatFileIds.join(", ")}`);
  header.push(
    "Files:",
    ...files.map(
      (f, i) =>
        `- #${i + 1} ${f.filename} • ${f.mimeType}${
          f.sizeBytes ? ` • ${formatBytes(f.sizeBytes)}` : ""
        } • id:${f.fileId} ${f.text ? "" : "(no extractable text)"}`
    )
  );
  return header.join("\n");
}

function renderExcerpt(f: ResolvedFileText, budget: number): string {
  const text = (f.text ?? "").trim();
  if (!text) return "(empty)";

  // Light pretty-print by mime
  if (isJSONLike(f.mimeType)) {
    try {
      const obj = JSON.parse(text);
      const pretty = JSON.stringify(obj, null, 2);
      return clip(pretty, budget, "json");
    } catch {
      // fall through to generic clipping
    }
  }
  if (isCSVLike(f.mimeType)) {
    // keep the first N lines
    const lines = text
      .split(/\r?\n/)
      .slice(0, Math.max(10, Math.floor(budget / 80)));
    return "```csv\n" + lines.join("\n") + "\n```";
  }

  // generic text clipping with head/tail
  return clip(text, budget, "text");
}

function isJSONLike(mime: string): boolean {
  return /(^|\+|\/)(json)$/.test(mime) || mime === "application/ld+json";
}

function isCSVLike(mime: string): boolean {
  return /(^text\/csv$)|(^application\/csv$)/.test(mime);
}

function clip(s: string, budget: number, tag: "text" | "json"): string {
  if (s.length <= budget) return fenced(tag, s);
  // head + tail with ellipsis
  const half = Math.max(200, Math.floor((budget - 20) / 2));
  const head = s.slice(0, half);
  const tail = s.slice(-half);
  return fenced(
    tag,
    head +
      "\n…\n" +
      tail +
      `\n<!-- clipped: kept ~${head.length + tail.length} of ${
        s.length
      } chars -->`
  );
}

function fenced(tag: "text" | "json", body: string): string {
  const fence = tag === "json" ? "```json" : "```";
  return `${fence}\n${body}\n\`\`\``;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(1)} ${units[u]}`;
}

async function resolveFileText(fileId: string) {
  // Example: fetch from your storage/extractor layer
  const file = await prisma.datasetFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      data: true,
    },
  });
  // `text` should already be extracted/converted (CSV/JSON/XLSX/PDF→text)

  if (!file) throw new Error("file not found or not accessible to this chat");

  const fileBlob: FileBlob = {
    name: file.filename,
    mediaType: file.mimeType as any,
    data: new Uint8Array(file.data), // adapt to your blob type
  };

  const { summary, previewText } = await normalizeForModel(fileBlob);

  return {
    fileId,
    filename: file?.filename ?? fileId,
    mimeType: file?.mimeType ?? "application/octet-stream",
    sizeBytes: file?.sizeBytes ?? null,
    text: previewText,
  };
}
