"use server";
import prisma from "@/lib/prisma";
import { parse } from "csv-parse/sync";

export type ColumnProfile = {
  name: string;
  inferredType: "string" | "number" | "boolean" | "date" | "unknown";
  nullRate: number;
  distinctCount: number;
  unitCandidates?: string[];
  regexHits?: Record<string, number>;
};

export type DatasetProfileResult = {
  rowCount: number;
  columns: ColumnProfile[];
};

export async function profileDatasetFile(
  datasetFileId: string
): Promise<DatasetProfileResult> {
  const file = await prisma.datasetFile.findUniqueOrThrow({
    where: { id: datasetFileId },
  });
  const text = Buffer.from(file.data).toString("utf8");
  const rows: string[][] = parse(text, { skip_empty_lines: true });
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
}

function inferType(values: string[]): ColumnProfile["inferredType"] {
  let n = 0,
    b = 0,
    d = 0;
  for (const v of values) {
    if (!isNaN(Number(v))) n++;
    else if (["true", "false"].includes(v.toLowerCase())) b++;
    else if (!isNaN(Date.parse(v))) d++;
  }
  const m = Math.max(n, b, d);
  if (m === 0) return "string";
  return m === n ? "number" : m === b ? "boolean" : "date";
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
