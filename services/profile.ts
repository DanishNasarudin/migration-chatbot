"use server";
import prisma from "@/lib/prisma";
import { parse } from "csv-parse/sync";

export type ColumnProfile = {
  name: string;
  inferredType:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "date"
    | "datetime"
    | "unknown";
  nullRate: number;
  distinctCount: number;
  unitCandidates?: string[];
  regexHits?: Record<string, number>;
};

export type DatasetProfileResult = {
  rowCount: number;
  columns: ColumnProfile[];
  error?: string;
};

export async function profileDatasetFile(
  datasetFileId: string
): Promise<DatasetProfileResult> {
  const file = await prisma.datasetFile.findUniqueOrThrow({
    where: { id: datasetFileId },
  });

  try {
    const text = Buffer.from(file.data).toString("utf8");
    const rows: string[][] = parse(text, {
      skip_empty_lines: true,
      delimiter: [",", ";"],
    });
    const header = rows[0];
    const body = rows.slice(1);

    const cols: ColumnProfile[] = header.map((name, colIdx) => {
      const values = body.map((r) => r[colIdx] ?? "");
      const nonNull = values.filter((v) => v !== "");
      const distinct = new Set(nonNull).size;

      const inferredType = inferType(nonNull);
      const unitCandidates = guessUnits(nonNull);

      return {
        name,
        inferredType,
        nullRate: values.length
          ? (values.length - nonNull.length) / values.length
          : 1,
        distinctCount: distinct,
        unitCandidates: unitCandidates.length ? unitCandidates : undefined,
      };
    });

    return { rowCount: body.length, columns: cols };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Closing Quote")) {
        return {
          rowCount: -1,
          columns: [],
          error: "Profile dataset fail: Parser delimter out of scope.",
        };
      }
      return { rowCount: -1, columns: [], error: error.message };
    } else {
      return { rowCount: -1, columns: [], error: "Unknown Error" };
    }
  }
}

function inferType(samples: unknown[]): ColumnProfile["inferredType"] {
  let n = 0,
    b = 0,
    d = 0;
  for (const v of samples) {
    if (v == null || v === "") continue;
    if (typeof v === "number") {
      n++;
      continue;
    }
    if (typeof v === "boolean") {
      b++;
      continue;
    }
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(s)) {
      d++;
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      n++;
      continue;
    }
  }
  if (d > 0 && d >= n && d >= b)
    return samples.some((v) => String(v).includes(":")) ? "datetime" : "date";
  if (n > 0 && n >= b)
    return samples.some((v) => /^\d+$/.test(String(v))) ? "integer" : "number";
  if (b > 0) return "boolean";
  return "string";
}

function guessUnits(values: string[]): string[] {
  // naive: looks for "RM", "MYR", "%", "kg", etc.
  const hits = new Map<string, number>();
  for (const v of values) {
    const m = v.match(/\b(RM|MYR|USD|kg|g|km|m|%|pcs)\b/i);
    if (m)
      hits.set(m[1].toUpperCase(), (hits.get(m[1].toUpperCase()) ?? 0) + 1);
  }
  return [...hits.entries()].sort((a, b) => b[1] - a[1]).map(([u]) => u);
}
