import { SpecDoc } from "@/types/spec";
import * as z from "zod/v3";

export type ValidationOptions = { unitTool?: boolean };
export type SchemaMatch = { precision: number; recall: number; f1: number };

export function zodFromSpec(spec: SpecDoc) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of spec.fields) {
    let t: z.ZodTypeAny =
      f.type === "number"
        ? z.preprocess(
            (v) => (v === "" ? null : Number(v)),
            z.number().finite()
          )
        : f.type === "boolean"
        ? z.preprocess(
            (v) => String(v).toLowerCase(),
            z.enum(["true", "false"])
          )
        : f.type === "date"
        ? z.preprocess((v) => new Date(String(v)), z.date())
        : z.string();

    if (f.enumVals?.length) t = z.enum(f.enumVals as [string, ...string[]]);
    if (f.regex) t = z.string().regex(new RegExp(f.regex));
    if (f.nullable !== false) t = t.nullable().optional();

    shape[f.name] = t;
  }
  return z.object(shape).strict();
}
