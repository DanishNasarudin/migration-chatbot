// app/(admin)/experiment/[id]/page.tsx
import { getExperimentDetail } from "@/services/experiment";
import {
  getLatencyStatsRaw,
  getReliabilityRaw,
  getSuccessRatesRaw,
  getThroughputStatsRaw,
  getTtftStatsRaw,
} from "@/services/metrics";

import ChartLatencyStats from "@/components/custom/chart-latency-stats";
import ChartLatencyThroughputCost from "@/components/custom/chart-latency-throughput-cost";
import ChartReliabilityStats from "@/components/custom/chart-reliability-stats";
import ChartThroughputStats from "@/components/custom/chart-throughput-stats";
import DownloadMetricsButton from "@/components/custom/download-metrics";
import { ExperimentFilters } from "@/components/custom/experiments-filter";
import { TrialsCharts } from "@/components/custom/trials-charts";
import { TrialsTable } from "@/components/custom/trials-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeDriftDeltas } from "@/services/robust";

type PageParams = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    model?: string;
    prompt?: string;
    drift?: string;
    unit?: string;
    days?: string;
  }>;
};

export default async function ExperimentDetailPage({
  params,
  searchParams,
}: PageParams) {
  const { id } = await params;

  // 1) Core experiment detail (trials + counts)
  const detail = await getExperimentDetail(id);

  // URL filters
  const model = (await searchParams).model || "";
  const prompt = (await searchParams).prompt || ""; // e.g. "fewshot" | "baseline" | "schema_guided" | "validation_only"
  const drift = (await searchParams).drift || ""; // e.g. "none" | "header_noise" | "unit_change" | ...
  const unit = (await searchParams).unit || "";
  const windowDays = Number.isFinite(Number((await searchParams).days))
    ? Math.max(1, Math.min(180, Number((await searchParams).days)))
    : 90;

  let tagLike: string | undefined;
  if (prompt && drift) {
    tagLike =
      prompt === "validation_only"
        ? `exp/validation_only:%:${drift}%`
        : `exp/schema:${prompt}:%:${drift}%`;
  } else if (prompt) {
    tagLike =
      prompt === "validation_only"
        ? `exp/validation_only:%`
        : `exp/schema:${prompt}:%`;
  } else if (drift) {
    tagLike = `exp/%:%:${drift}%`;
  }

  // Performance metrics (ModelRun slice)
  const perfOpts = {
    scope: "experiment" as const,
    experimentId: id,
    windowDays,
    modelId: model || null,
    tagLike: tagLike || null,
  };
  const [succ, lat, ttft, thr, rel] = await Promise.all([
    getSuccessRatesRaw(perfOpts),
    getLatencyStatsRaw(perfOpts),
    getTtftStatsRaw(perfOpts),
    getThroughputStatsRaw(perfOpts),
    getReliabilityRaw(perfOpts),
  ]);

  // Accuracy cards: compute macro after filtering trials by the same criteria
  const filteredTrials = detail.trials.filter((t) => {
    if (model && t.modelId !== model) return false;
    if (prompt && t.promptMode !== prompt) return false;
    if (drift && (t.driftCase ?? "none") !== drift) return false;
    if (unit && (String(t.unitTool) ?? "none") !== unit) return false;
    return true;
  });
  const trialsForStats = filteredTrials.length ? filteredTrials : detail.trials;
  const num = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);
  const meanOf = (key: keyof (typeof trialsForStats)[number]) => {
    const arr = trialsForStats.map((x) => x[key]).filter(num) as number[];
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : undefined;
  };
  const validRowsPct = (() => {
    const explicit = trialsForStats
      .map((t: any) => t.validRowsPct)
      .filter(num) as number[];
    if (explicit.length)
      return explicit.reduce((s, x) => s + x, 0) / explicit.length;
    const computed = trialsForStats
      .map((t) =>
        num((t as any).validRows) &&
        num((t as any).totalRows) &&
        (t as any).totalRows > 0
          ? (t as any).validRows / (t as any).totalRows
          : undefined
      )
      .filter(num) as number[];
    return computed.length
      ? computed.reduce((s, x) => s + x, 0) / computed.length
      : undefined;
  })();
  const passRate = trialsForStats.length
    ? trialsForStats.filter((t) => t.passed).length / trialsForStats.length
    : 0;

  const macro = {
    f1: meanOf("f1"),
    precision: meanOf("precision"),
    recall: meanOf("recall"),
    typeAcc: meanOf("typeAcc"),
    unitAcc: meanOf("unitAcc"),
    validRowsPct,
    passRate,
  };

  const { deltaRows, deltaSummary } = computeDriftDeltas(
    detail.trials, // full set for baselines
    trialsForStats // filtered set for the drifted view the user is looking at
  );

  // Distinct option lists from trials (for filter controls)
  const modelOptions = Array.from(
    new Set(detail.trials.map((t) => t.modelId))
  ).sort();
  const promptOptions = Array.from(
    new Set(detail.trials.map((t) => t.promptMode))
  ).sort();
  const driftOptions = Array.from(
    new Set(detail.trials.map((t) => t.driftCase ?? "none"))
  ).sort();
  const unitOptions = Array.from(
    new Set(detail.trials.map((t) => String(t.unitTool) ?? "none"))
  ).sort();

  const exportPayload = {
    experiment: {
      id: detail.id,
      name: detail.name,
      datasetLabel: detail.datasetLabel,
      specLabel: detail.specLabel,
      createdAt: new Date(detail.createdAt).toISOString(),
      description: detail.description ?? null,
      summary: {
        combinations: detail.matrix.combinations,
        trials: detail.trialsCount,
        passed: detail.passedCount,
        failed: detail.failedCount,
      },
    },
    filters: {
      model,
      prompt,
      drift,
      windowDays,
      tagLike: tagLike ?? null,
    },
    macro, // passRate, f1, precision, recall, typeAcc, unitAcc, validRowsPct
    performance: {
      successRates: succ,
      latency: lat,
      ttft,
      throughput: thr,
      reliability: rel,
    },
    drift: {
      deltaSummary,
      deltaRows,
    },
    trials: detail.trials,
  } as const;

  const fileName = `experiment-${detail.id}-metrics-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{detail.name}</h1>
        <div className="text-sm text-muted-foreground">
          Dataset: {detail.datasetLabel} · Spec: {detail.specLabel} · Created:{" "}
          {new Date(detail.createdAt).toLocaleString()}
        </div>
        <div className="text-sm">
          Combos:{" "}
          <span className="font-mono">{detail.matrix.combinations}</span> ·
          Trials: <span className="font-mono">{detail.trialsCount}</span> ·
          Passed: <span className="font-mono">{detail.passedCount}</span> ·
          Failed: <span className="font-mono">{detail.failedCount}</span>
        </div>
        {detail.description && <p className="text-sm">{detail.description}</p>}
      </div>

      <ExperimentFilters
        modelOptions={modelOptions}
        promptOptions={promptOptions}
        driftOptions={driftOptions}
        unitOptions={unitOptions}
      />

      {/* Accuracy summary (thesis metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pass rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {(100 * (macro.passRate ?? 0)).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">F1 (macro)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {macro.f1 != null ? macro.f1.toFixed(3) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Precision</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {macro.precision != null ? macro.precision.toFixed(3) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recall</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {macro.recall != null ? macro.recall.toFixed(3) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Type accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {macro.typeAcc != null ? macro.typeAcc.toFixed(3) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Unit accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {macro.unitAcc != null ? macro.unitAcc.toFixed(3) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Valid rows %</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {macro.validRowsPct != null
                ? (100 * macro.validRowsPct).toFixed(1) + "%"
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Trials</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{detail.trialsCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance slice (this experiment only) */}
      <div className="grid md:grid-cols-2 gap-4">
        <ChartReliabilityStats chartData={rel} />
        <ChartLatencyStats chartData={lat} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <ChartLatencyThroughputCost latency={lat} throughput={thr} />
        <ChartThroughputStats chartData={thr} />
      </div>

      {/* Accuracy breakdowns & evolution */}
      <TrialsCharts trials={detail.trials} />
      <DownloadMetricsButton
        filename={fileName}
        payload={exportPayload}
        className="shrink-0"
      />
      {/* All trials table with filters */}
      <TrialsTable experimentId={detail.id} trials={detail.trials} />

      {/* Robustness — Δ vs baseline (summary by drift) */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Robustness — Δ vs baseline (by drift)
        </h2>
        <div className="rounded-lg border mt-4 max-h-[600px] overflow-hidden overflow-y-auto relative">
          <Table noWrapper>
            <TableHeader className="sticky top-0 z-10 bg-background border-b-[1px] border-border">
              <TableRow>
                <TableHead>Drift</TableHead>
                <TableHead className="text-right">Level</TableHead>
                <TableHead className="text-right">Trials</TableHead>
                <TableHead className="text-right">ΔF1</TableHead>
                <TableHead className="text-right">ΔPrecision</TableHead>
                <TableHead className="text-right">ΔRecall</TableHead>
                <TableHead className="text-right">ΔType&nbsp;Acc</TableHead>
                <TableHead className="text-right">
                  ΔValid&nbsp;Rows&nbsp;%
                </TableHead>
                <TableHead className="text-right">ΔUnit&nbsp;Acc</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deltaSummary.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    No drifted trials (or baselines missing).
                  </TableCell>
                </TableRow>
              ) : (
                deltaSummary
                  .sort(
                    (a, b) =>
                      (a.driftKind > b.driftKind ? 1 : -1) ||
                      (a.driftLevel ?? 0) - (b.driftLevel ?? 0)
                  )
                  .map((r) => (
                    <TableRow key={`${r.driftKind}:${r.driftLevel ?? "?"}`}>
                      <TableCell className="font-medium">
                        {r.driftKind}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.driftLevel ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.n}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.dF1) ? r.dF1!.toFixed(3) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.dPrecision) ? r.dPrecision!.toFixed(3) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.dRecall) ? r.dRecall!.toFixed(3) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.dTypeAcc) ? r.dTypeAcc!.toFixed(3) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.dValidRowsPct)
                          ? `${(100 * r.dValidRowsPct!).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(r.dUnitAcc) ? r.dUnitAcc!.toFixed(3) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Optional: per-scenario Δ details (good for appendix/debug) */}
      <div className="space-y-2">
        <h3 className="text-base font-medium">
          Per-scenario Δ (model × prompt × unit)
        </h3>
        <div className="rounded-lg border mt-4 max-h-[600px] overflow-hidden overflow-y-auto relative">
          <Table noWrapper>
            <TableHeader className="sticky top-0 z-10 bg-background border-b-[1px] border-border">
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Drift</TableHead>
                <TableHead className="text-right">Level</TableHead>
                <TableHead className="text-right">n</TableHead>
                <TableHead className="text-right">ΔF1</TableHead>
                <TableHead className="text-right">ΔPrecision</TableHead>
                <TableHead className="text-right">ΔRecall</TableHead>
                <TableHead className="text-right">ΔType</TableHead>
                <TableHead className="text-right">ΔUnit</TableHead>
                <TableHead className="text-right">ΔValid%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deltaRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="text-center text-muted-foreground"
                  >
                    No deltas to display.
                  </TableCell>
                </TableRow>
              ) : (
                deltaRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.modelId}</TableCell>
                    <TableCell>{r.promptMode}</TableCell>
                    <TableCell>{r.unitTool ? "On" : "Off"}</TableCell>
                    <TableCell>{r.driftKind}</TableCell>
                    <TableCell className="text-right">
                      {r.driftLevel ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.n}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.dF1) ? r.dF1!.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.dPrecision) ? r.dPrecision!.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.dRecall) ? r.dRecall!.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.dTypeAcc) ? r.dTypeAcc!.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.dUnitAcc) ? r.dUnitAcc!.toFixed(3) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(r.dValidRowsPct)
                        ? `${(100 * r.dValidRowsPct!).toFixed(1)}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
