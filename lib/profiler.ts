import { ColumnProfile } from "@/services/profile";

export function inferType(samples: unknown[]): ColumnProfile["inferredType"] {
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

export function detectUnits(colName: string, samples: unknown[]): string[] {
  const name = colName.toLowerCase();
  const candidates = new Set<string>();

  // header hints
  if (/\bkg\b/.test(name)) candidates.add("kg");
  if (/\b(g|gram)s?\b/.test(name)) candidates.add("g");
  if (/\bcm\b/.test(name)) candidates.add("cm");
  if (/\bmm\b/.test(name)) candidates.add("mm");
  if (/\bmyr|rm\b/.test(name)) candidates.add("MYR");
  if (/\busd\b/.test(name)) candidates.add("USD");
  if (/%|percent|percentage/.test(name)) candidates.add("%");

  // value hints
  for (const v of samples) {
    if (v == null) continue;
    const s = String(v).toLowerCase();
    if (/\d\s?(kg)\b/.test(s)) candidates.add("kg");
    if (/\d\s?(g)\b/.test(s)) candidates.add("g");
    if (/\d\s?(cm)\b/.test(s)) candidates.add("cm");
    if (/\d\s?(mm)\b/.test(s)) candidates.add("mm");
    if (/(myr|rm)\s?\d/.test(s)) candidates.add("MYR");
    if (/\b\$?\s?\d/.test(s) && !candidates.has("MYR")) candidates.add("USD");
    if (/%\s*$/.test(s)) candidates.add("%");
  }

  return Array.from(candidates).slice(0, 3);
}

export function computeNullRate(values: unknown[], total: number): number {
  const nulls: number = values.reduce<number>(
    (acc, v) => acc + (v == null || v === "" ? 1 : 0),
    0
  );
  return total > 0 ? nulls / total : 0;
}
