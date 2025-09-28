// schema-gen.ts (server)
"use server";

import { myProvider } from "@/lib/ai/models";
import prisma from "@/lib/prisma";
import { PredictedSpec } from "@/types/schema";
import { generateObject, streamObject, streamText } from "ai";
import { parse } from "csv-parse/sync";
import { profileDatasetFile } from "./profile";

type SchemaGenOptions = {
  modelId: string;
  datasetFileId: string;
  sampleRows?: number;
  promptMode: "baseline" | "few_shot" | "schema_guided";
  domainHint?: string | null;
  driftCase?: string | null;
  stream?: boolean; // default true
  timeoutMs?: number; // default 30000
  fallbackToNonStreaming?: boolean; // default true
};

// ---------- helpers ----------
function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label = "timeout"
): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(label)), ms)
    ),
  ]);
}

async function firstPartialTTFT(
  iter: AsyncIterable<unknown>,
  started: number,
  ms: number
): Promise<number | undefined> {
  return await Promise.race([
    (async () => {
      for await (const _ of iter) {
        return Date.now() - started; // TTFT
      }
      return undefined; // stream closed with no partials
    })(),
    new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), ms)
    ),
  ]);
}

async function firstPartialTTFTMs<T>(
  partial: AsyncIterable<T> | undefined,
  started: number
) {
  if (!partial) return undefined; // no stream support from provider/object mode
  try {
    // Read just one partial update
    const it = partial[Symbol.asyncIterator]();
    const first = await it.next();
    if (!first.done) return Date.now() - started;
    return undefined; // stream ended without yielding any partial
  } catch {
    return undefined;
  }
}

async function measureTokenTTFT(
  model: any,
  system: string,
  prompt: string
): Promise<number | undefined> {
  const started = Date.now();
  try {
    const res = await streamText({ model, system, prompt });

    // Read just the first chunk
    const it = res.textStream[Symbol.asyncIterator]();
    const first = await it.next();
    if (first.done) return undefined;

    const ttft = Date.now() - started;

    // Best-effort abort (not always typed on older SDKs)
    try {
      (res as any)?.controller?.abort?.();
    } catch {
      /* ignore */
    }

    return ttft;
  } catch {
    return undefined;
  }
}

function normalizeAiError(
  err: unknown,
  stage: "streamObject" | "generateObject"
) {
  const e = err as any;
  const msg = e?.message ?? String(e);
  const timeout = /timeout/i.test(msg);
  const code = timeout ? "timeout" : "provider_error";
  return { stage, code, message: msg };
}

function applyDrift(header: string[], rows: string[][], drift?: string | null) {
  if (!drift) return { header, rows };
  switch (drift) {
    case "header_noise":
      return {
        header: header.map((h) =>
          Math.random() < 0.4 ? h.replaceAll("_", " ").toUpperCase() : h
        ),
        rows,
      };
    case "unit_change":
      return {
        header: header.map((h) =>
          /(amount|price|total)/i.test(h) ? `${h} (USD)` : h
        ),
        rows,
      };
    case "type_shift":
      return {
        header,
        rows: rows.map((r) =>
          r.map((v) => (Math.random() < 0.2 ? `"${v}"` : v))
        ),
      };
    case "missing_field":
      return {
        header: header.slice(0, -1),
        rows: rows.map((r) => r.slice(0, -1)),
      };
    default:
      return { header, rows };
  }
}

type TypeHint = "string" | "number" | "boolean" | "date" | "datetime";

type ProfileHint = {
  name: string;
  typeHint: TypeHint;
  nullRate: number; // 0..1
  uniqueRate: number; // 0..1
  unitHint: string | null;
  enumVals: string[]; // small, capped list
};

// map profiler→prompt fields
function coerceType(t: string): TypeHint {
  switch (t) {
    case "integer":
      return "number";
    case "unknown":
      return "string";
    case "string":
    case "number":
    case "boolean":
    case "date":
    case "datetime":
      return t;
    default:
      return "string";
  }
}

/** Build prompt hints from ColumnProfile[].
 *  @param profiles: your profiler’s columns
 *  @param rowCount: total rows used to compute distinct/null rates (non-null = rowCount * (1 - nullRate))
 */
function toProfileHints(
  profiles: Array<{
    name: string;
    inferredType: string;
    nullRate: number;
    distinctCount: number;
    unitCandidates?: string[]; // if present
    enumCandidates?: string[]; // if present
  }>,
  rowCount: number
): ProfileHint[] {
  return profiles.map((p) => {
    const nonNull = Math.max(1, Math.round(rowCount * (1 - (p.nullRate ?? 0))));
    const uniqueRate = Math.min(1, nonNull ? p.distinctCount / nonNull : 0);
    const unitHint =
      Array.isArray(p.unitCandidates) && p.unitCandidates.length
        ? p.unitCandidates[0]
        : null;
    const enumVals = Array.isArray(p.enumCandidates)
      ? p.enumCandidates.slice(0, 20)
      : [];

    return {
      name: p.name,
      typeHint: coerceType(p.inferredType),
      nullRate: p.nullRate ?? 0,
      uniqueRate,
      unitHint,
      enumVals,
    };
  });
}

function buildPrompt({
  header,
  rows,
  domainHint,
  promptMode,
  profile,
}: {
  header: string[];
  rows: string[][];
  domainHint?: string | null;
  promptMode: SchemaGenOptions["promptMode"];
  profile?: ProfileHint[];
}) {
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const system = [
    "You are a strict data schema extractor.",
    "Infer a tabular schema from the CSV sample.",
    "Return only fields with stable names & types suitable for validation.",
    "Prefer snake_case for field names.",
    domainHint ? `Domain context: ${domainHint}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const FEWSHOT_EXAMPLES = [
    {
      csv: `order_id,amount (MYR),status,created_at
A-1001,129.50,PAID,2024-01-05
A-1002,0.00,VOID,2024-01-06`,
      schema: {
        version: "1.0",
        title: "orders",
        fields: [
          {
            name: "order_id",
            type: "string",
            nullable: false,
            enumVals: [],
            isPrimary: true,
          },
          {
            name: "amount",
            type: "number",
            nullable: false,
            enumVals: [],
            isPrimary: false,
            unit: "MYR",
          },
          {
            name: "status",
            type: "string",
            nullable: false,
            enumVals: ["PAID", "VOID"],
            isPrimary: false,
          },
          {
            name: "created_at",
            type: "date",
            nullable: false,
            enumVals: [],
            isPrimary: false,
          },
        ],
      },
    },
    {
      csv: `patient_id,age,smoker,last_visit
P-01,34,false,2024-08-10
P-02,,true,2024-08-12`,
      schema: {
        version: "1.0",
        title: "patients",
        fields: [
          {
            name: "patient_id",
            type: "string",
            nullable: false,
            enumVals: [],
            isPrimary: true,
          },
          {
            name: "age",
            type: "number",
            nullable: true,
            enumVals: [],
            isPrimary: false,
          },
          {
            name: "smoker",
            type: "boolean",
            nullable: false,
            enumVals: [],
            isPrimary: false,
          },
          {
            name: "last_visit",
            type: "date",
            nullable: false,
            enumVals: [],
            isPrimary: false,
          },
        ],
      },
    },
  ];

  const fewshot =
    promptMode === "few_shot"
      ? [
          "Follow these examples:",
          ...FEWSHOT_EXAMPLES.slice(1).map((ex, i) =>
            [
              `Example ${i + 1} CSV:`,
              "```csv",
              ex.csv,
              "```",
              "Expected JSON:",
              "```json",
              JSON.stringify(ex.schema, null, 2),
              "```",
            ].join("\n")
          ),
          "Rules:",
          "- Only include columns that exist in the CSV header.",
          "- Use snake_case field names.",
          "- Allowed types: string | number | boolean | date | datetime.",
          "- Set isPrimary=true only when the column is a likely unique identifier.",
          "- If the header includes a unit in parentheses, put that unit in `unit`.",
          "- If values are a small closed set, put them in `enumVals` (keep type=string).",
        ].join("\n")
      : "";

  //   const fewshot =
  // promptMode === "few_shot"
  //   ? `Example: fields=[{name:"order_id",type:"string",nullable:false},{name:"amount",type:"number",unit:"MYR"}]`
  //   : "";

  let guided = "";
  if (promptMode === "schema_guided" && profile?.length) {
    const heuristics = [
      "Heuristics:",
      "- Allowed types: string | number | boolean | date | datetime.",
      "- nullable=true if nullRate > 0.00.",
      "- isPrimary=true if uniqueRate ≥ 0.98 AND nullRate ≤ 0.01.",
      "- If enumCandidate=true, set enumVals to the observed categories (do not mix with numeric types).",
      "- If header contains a unit in parentheses, set unit accordingly.",
    ].join("\n");

    const lines = profile.map(
      (p) =>
        `- ${p.name}: typeHint=${p.typeHint ?? "string"}, ` +
        `nullRate=${((p.nullRate ?? 0) * 100).toFixed(1)}%, ` +
        `uniqueRate=${((p.uniqueRate ?? 0) * 100).toFixed(1)}%, ` +
        `unitHint=${p.unitHint ?? "—"}` +
        (p.enumVals?.length
          ? `, enums=${p.enumVals.slice(0, 8).join(" | ")}`
          : "")
    );

    guided = [heuristics, "PROFILE:", ...lines].join("\n");
  }
  // const guided =
  //   promptMode === "schema_guided"
  //     ? `If a column looks like an ID, mark isPrimary=true. If values are finite set, suggest enumVals. If numeric text contains units, infer unit.`
  //     : "";
  const user = [
    "Infer the schema for the following CSV sample.",
    "CSV:",
    "```csv",
    csv,
    "```",
    fewshot,
    guided,
  ].join("\n");
  return { system, user };
}

// ---------- main ----------
export async function generatePredictedSpec(opts: SchemaGenOptions) {
  const {
    modelId,
    datasetFileId,
    sampleRows = 30,
    promptMode,
    domainHint,
    driftCase,
    stream = true,
    timeoutMs = 30_000,
    fallbackToNonStreaming = true,
  } = opts;

  // load sample
  const file = await prisma.datasetFile.findUniqueOrThrow({
    where: { id: datasetFileId },
  });
  const text = Buffer.from(file.data).toString("utf8");
  const rows: string[][] = parse(text, {
    skip_empty_lines: true,
    delimiter: [",", ";"],
  });
  const header = rows[0];
  const body = rows.slice(1);
  const take = Math.max(5, Math.min(sampleRows, body.length));
  const sampled = body.slice(0, take);

  const drifted = applyDrift(header, sampled, driftCase);
  const prof = await profileDatasetFile(datasetFileId); // or whatever your export is
  const hints = toProfileHints(prof.columns, prof.rowCount);
  const { system, user } = buildPrompt({
    header: drifted.header,
    rows: drifted.rows,
    domainHint: domainHint ?? undefined,
    promptMode,
    profile: hints,
  });

  const model = myProvider.languageModel(modelId);
  const started = Date.now();

  try {
    if (stream) {
      // streamObject returns a handle (NOT a Promise)
      const streamed = streamObject({
        model,
        schema: PredictedSpec,
        system,
        prompt: user,
      });

      const ttftMs = await measureTokenTTFT(model, system, user);

      // Await final object with timeout
      const object = await withTimeout(
        streamed.object,
        timeoutMs,
        "object timeout"
      );

      const sUsage =
        (streamed as any).usage ?? (streamed as any).response?.usage;

      return {
        object,
        telemetry: {
          durationServerMs: Date.now() - started,
          ttftMs,
          stage: "streamObject" as const,
          inputTokens: sUsage?.inputTokens ?? null,
          outputTokens: sUsage?.outputTokens ?? null,
          totalTokens: sUsage?.totalTokens ?? null,
        },
      };
    }

    // non-streaming path
    const { object, usage } = await withTimeout(
      generateObject({ model, schema: PredictedSpec, system, prompt: user }),
      timeoutMs,
      "generateObject timeout"
    );

    return {
      object,
      telemetry: {
        durationServerMs: Date.now() - started,
        ttftMs: undefined,
        stage: "generateObject" as const,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
      },
    };
  } catch (err) {
    if (stream && fallbackToNonStreaming) {
      try {
        const { object, usage } = await withTimeout(
          generateObject({
            model,
            schema: PredictedSpec,
            system,
            prompt: user,
          }),
          timeoutMs,
          "generateObject timeout (fallback)"
        );
        return {
          object,
          telemetry: {
            durationServerMs: Date.now() - started,
            ttftMs: undefined,
            stage: "generateObject" as const,
            fallbackFrom: "streamObject" as const,
            inputTokens: usage?.inputTokens ?? null,
            outputTokens: usage?.outputTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,
          },
        };
      } catch (err2) {
        throw normalizeAiError(err2, "generateObject");
      }
    }
    throw normalizeAiError(err, "streamObject");
  }
}
