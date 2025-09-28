import { TrialRow } from "./experiment";

// export type TrialLike = {
//   modelId: string;
//   promptMode: string;
//   unitTool: boolean;
//   driftCase?: string | null;
//   f1?: number;
//   precision?: number;
//   recall?: number;
//   typeAcc?: number;
//   unitAcc?: number;
//   validRows?: number;
//   totalRows?: number;
//   validRowsPct?: number;
// };

export type DeltaRow = {
  modelId: string;
  promptMode: string;
  unitTool: boolean;
  driftKind: string;
  driftLevel: number | null;
  n: number;
  dF1?: number;
  dPrecision?: number;
  dRecall?: number;
  dTypeAcc?: number;
  dUnitAcc?: number;
  dValidRowsPct?: number;
};

export type DriftSummary = {
  driftKind: string;
  driftLevel: number | null;
  n: number;
  dF1?: number;
  dPrecision?: number;
  dRecall?: number;
  dTypeAcc?: number;
  dUnitAcc?: number;
  dValidRowsPct?: number;
};

const num = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const avg = (xs: Array<number | undefined>) => {
  const a = xs.filter(num) as number[];
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : undefined;
};

// valid rows percentage with fallback if not precomputed
export function validPctOf(t: TrialRow) {
  if (num(t.validRowsPct)) return t.validRowsPct!;
  if (num(t.validRows) && num(t.totalRows) && t.totalRows! > 0)
    return t.validRows! / t.totalRows!;
  return undefined;
}

// normalize drift string → { kind, level }
export function parseDrift(raw: string | null | undefined) {
  if (!raw || raw.toLowerCase() === "none")
    return { kind: "none", level: null as number | null };
  const s = String(raw);
  const m =
    s.match(/(?:^|[:_\-])l(?:evel)?\s*([1-3])$/i) || // ...:L2 / ..._level3 / ..._l1
    s.match(/([1-3])$/); // ...2
  const level = m ? Number(m[1]) : null;
  let kind = s;
  if (m) {
    const idx = s.lastIndexOf(m[1]);
    const pre = s.slice(0, idx);
    kind = pre.replace(/[:_\-\s]*l(?:evel)?\s*$/i, "").replace(/[:_\-\s]$/, "");
  }
  return { kind: kind || "none", level };
}

const keyFor = (t: TrialRow) =>
  `${t.modelId}__${t.promptMode}__${t.unitTool ? "unitOn" : "unitOff"}`;

export function computeDriftDeltas(
  allTrials: TrialRow[],
  filteredTrials?: TrialRow[]
): { deltaRows: DeltaRow[]; deltaSummary: DriftSummary[] } {
  const trialsForStats =
    filteredTrials && filteredTrials.length ? filteredTrials : allTrials;

  // ---- baselines (no-drift) per scenario (model, prompt, unitTool)
  const baselineMap = new Map<
    string,
    {
      f1?: number;
      precision?: number;
      recall?: number;
      typeAcc?: number;
      unitAcc?: number;
      validRowsPct?: number;
    }
  >();

  {
    const groups = new Map<string, TrialRow[]>();
    for (const t of allTrials) {
      const { kind } = parseDrift(t.driftCase ?? "none");
      if (kind !== "none") continue;
      const k = keyFor(t);
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    for (const [k, rows] of groups) {
      baselineMap.set(k, {
        f1: avg(rows.map((r) => r.f1)),
        precision: avg(rows.map((r) => r.precision)),
        recall: avg(rows.map((r) => r.recall)),
        typeAcc: avg(rows.map((r) => r.typeAcc)),
        unitAcc: avg(rows.map((r) => r.unitAcc)),
        validRowsPct: avg(rows.map((r) => validPctOf(r))),
      });
    }
  }

  // ---- build per-scenario deltas from drifted rows in the filtered view
  const group = new Map<string, TrialRow[]>();
  for (const t of trialsForStats) {
    const { kind, level } = parseDrift(t.driftCase ?? "none");
    if (kind === "none") continue;
    const gkey = `${keyFor(t)}__${kind}__${level ?? "L?"}`;
    group.set(gkey, [...(group.get(gkey) ?? []), t]);
  }

  const deltaRows: DeltaRow[] = [];
  for (const [gkey, rows] of group) {
    const one = rows[0]!;
    const { kind, level } = parseDrift(one.driftCase ?? "none");
    const base = baselineMap.get(keyFor(one));
    if (!base) continue;

    const f1 = avg(rows.map((r) => r.f1));
    const precision = avg(rows.map((r) => r.precision));
    const recall = avg(rows.map((r) => r.recall));
    const typeAcc = avg(rows.map((r) => r.typeAcc));
    const unitAcc = avg(rows.map((r) => r.unitAcc));
    const vPct = avg(rows.map((r) => validPctOf(r)));

    deltaRows.push({
      modelId: one.modelId,
      promptMode: one.promptMode || "baseline",
      unitTool: one.unitTool,
      driftKind: kind,
      driftLevel: level,
      n: rows.length,
      dF1: num(f1) && num(base.f1) ? f1 - base.f1! : undefined,
      dPrecision:
        num(precision) && num(base.precision)
          ? precision - base.precision!
          : undefined,
      dRecall:
        num(recall) && num(base.recall) ? recall - base.recall! : undefined,
      dTypeAcc:
        num(typeAcc) && num(base.typeAcc) ? typeAcc - base.typeAcc! : undefined,
      dUnitAcc:
        num(unitAcc) && num(base.unitAcc) ? unitAcc - base.unitAcc! : undefined,
      dValidRowsPct:
        num(vPct) && num(base.validRowsPct)
          ? vPct - base.validRowsPct!
          : undefined,
    });
  }

  // ---- summary by (driftKind, driftLevel)
  const summaryMap = new Map<string, any>();
  for (const r of deltaRows) {
    const k = `${r.driftKind}__${r.driftLevel ?? "L?"}`;
    const s = summaryMap.get(k) ?? {
      driftKind: r.driftKind,
      driftLevel: r.driftLevel,
      n: 0,
    };
    const add = (name: keyof DeltaRow) => {
      const v = r[name] as number | undefined;
      if (!num(v)) return;
      s[`${String(name)}Sum`] = (s[`${String(name)}Sum`] ?? 0) + v;
      s[`${String(name)}Cnt`] = (s[`${String(name)}Cnt`] ?? 0) + 1;
    };
    s.n += r.n;
    add("dF1");
    add("dPrecision");
    add("dRecall");
    add("dTypeAcc");
    add("dUnitAcc");
    add("dValidRowsPct");
    summaryMap.set(k, s);
  }

  const mean = (s: any, key: keyof DriftSummary) => {
    const sum = s[`${String(key)}Sum`],
      cnt = s[`${String(key)}Cnt`];
    return num(sum) && num(cnt) && cnt > 0 ? sum / cnt : undefined;
  };

  const deltaSummary = [...summaryMap.values()].map((s) => ({
    driftKind: s.driftKind,
    driftLevel: s.driftLevel,
    n: s.n,
    dF1: mean(s, "dF1"),
    dPrecision: mean(s, "dPrecision"),
    dRecall: mean(s, "dRecall"),
    dTypeAcc: mean(s, "dTypeAcc"),
    dUnitAcc: mean(s, "dUnitAcc"),
    dValidRowsPct: mean(s, "dValidRowsPct"),
  }));

  return { deltaRows, deltaSummary };
}
