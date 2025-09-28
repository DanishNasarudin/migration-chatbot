import { FieldSpec, SpecDoc } from "@/types/spec";
import * as z from "zod/v3";

export type ValidationOptions = { unitTool?: boolean };
export type SchemaMatch = { precision: number; recall: number; f1: number };

export function zodFromSpec(spec: SpecDoc, opts: ValidationOptions = {}) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const f of spec.fields as FieldSpec[]) {
    let t: z.ZodTypeAny;

    switch (f.type) {
      case "number":
        const base = z.number().finite();
        const withNull = f.nullable ? base.nullable() : base;

        t = z.preprocess((v) => coerceNumberWithSeparators(v, opts), withNull);
        break;

      case "boolean":
        t = z.preprocess(strictBoolean, z.boolean());
        break;

      case "date":
        t = z.preprocess(coerceDate, z.date());
        break;

      case "string":
      default:
        // If the raw value is a number (e.g., 123), keep it as "123"
        // t = z.preprocess(
        //   (v) => (v == null || v === "" ? v : String(v).trim()),
        //   z.string()
        // );
        t = z.string();
        break;
    }

    // Enums take precedence; keep them on string base
    if (f.enumVals?.length) {
      t = z.preprocess(
        (v) => (v == null || v === "" ? v : String(v)),
        z.enum(f.enumVals as [string, ...string[]])
      );
    }

    // Optional regex constraint for strings
    if (f.regex && (f.type === "string" || f.enumVals?.length)) {
      t = (t as z.ZodString | z.ZodEnum<[string, ...string[]]>).refine(
        (val) => new RegExp(f.regex!).test(String(val)),
        {
          message: `String does not match required pattern`,
        }
      );
    }

    // Nullability/optional (keeps your original behavior)
    if (f.nullable) t = t.nullish();

    shape[f.name] = t;
  }

  return z.object(shape).strict();
}

/**
 * Accepts:
 *  "1,234"  -> 1234
 *  "1,234.56" -> 1234.56
 *  "(1,234.56)" -> -1234.56
 *  " 1.2e3 " -> 1200
 *  "" or null/undefined -> stays as-is (for nullable/optional handling)
 */
function coerceNumberWithSeparators(v: unknown, opts: ValidationOptions) {
  if (v == null || v === "") return v;
  if (typeof v === "number") return v;

  if (typeof v === "string") {
    let s = v.trim();
    if (s === "") return v;

    // Optional: capture only the leading numeric token if you enable a unit-extractor later.
    if (opts.unitTool) {
      const m = s.match(
        /^\(?[-+\u2212]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[-+]?\d+)?\)?/i
      );
      if (m) s = m[0];
    }

    // Accounting negative via parentheses
    const isParenNeg = /^\(.*\)$/.test(s);
    if (isParenNeg) s = s.slice(1, -1).trim();

    // Normalize Unicode minus sign to ASCII hyphen
    s = s.replace(/\u2212/g, "-");

    // Validate allowed numeric pattern that may include thousands commas before we strip them
    const thousandPattern =
      /^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[-+]?\d+)?$/i;
    const noSepPattern = /^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i;

    let candidate = s;
    if (thousandPattern.test(candidate)) {
      candidate = candidate.replace(/,/g, "");
    } else if (!noSepPattern.test(candidate)) {
      // allow spaces or underscores as accidental groupers
      const compact = candidate.replace(/[ _]/g, "");
      if (noSepPattern.test(compact)) candidate = compact;
      else return null; // not a valid numeric string; let Zod raise an error
    }

    const n = Number(candidate);
    if (!Number.isFinite(n)) return v;

    return isParenNeg ? -n : n;
  }

  return v; // non-string/number; let Zod report type error
}

/** Safe boolean coercion: maps common spellings, avoids Boolean("false") gotcha */
function strictBoolean(v: unknown) {
  if (v == null || v === "") return v;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (["true", "t", "1", "yes", "y"].includes(s)) return true;
  if (["false", "f", "0", "no", "n"].includes(s)) return false;
  return v;
}

/** Accepts ISO strings, timestamps, or Date; Zod will reject invalid dates */
function coerceDate(v: unknown) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  return new Date(String(v));
}
