import { PredictedSpec } from "@/types/schema";
import { SpecDoc } from "@/types/spec";

export function compareFieldSets(gt: SpecDoc, pred: PredictedSpec) {
  const gtNames = new Set(gt.fields.map((f) => f.name.toLowerCase()));
  const pdNames = new Set(pred.fields.map((f) => f.name.toLowerCase()));

  let tp = 0;
  for (const n of pdNames) if (gtNames.has(n)) tp++;

  const precision = pdNames.size ? tp / pdNames.size : 0;
  const recall = gtNames.size ? tp / gtNames.size : 0;
  const f1 =
    precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

export function typeMatchRate(gt: SpecDoc, pred: PredictedSpec) {
  const gtMap = new Map(gt.fields.map((f) => [f.name.toLowerCase(), f.type]));
  let total = 0,
    ok = 0;
  for (const f of pred.fields) {
    const t = gtMap.get(f.name.toLowerCase());
    if (!t) continue;
    total++;
    ok += t === f.type ? 1 : 0;
  }
  return total ? ok / total : 0;
}

export function unitMatchRate(gt: SpecDoc, pred: PredictedSpec) {
  const gtMap = new Map(
    gt.fields.map((f) => [f.name.toLowerCase(), (f as any).unit ?? null])
  );
  let total = 0,
    ok = 0;
  for (const f of pred.fields) {
    const u = gtMap.get(f.name.toLowerCase());
    if (u == null) continue; // only score fields that define a unit in GT
    total++;
    ok += (f.unit ?? null) === u ? 1 : 0;
  }
  return total ? ok / total : 0;
}
