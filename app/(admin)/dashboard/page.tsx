// app/(admin)/dashboard/page.tsx
import ChartLatencyStats from "@/components/custom/chart-latency-stats";
import ChartReliabilityStats from "@/components/custom/chart-reliability-stats";
import ChartThroughputStats from "@/components/custom/chart-throughput-stats";
import ChartTtftStats from "@/components/custom/chart-ttft-stats";
import prisma from "@/lib/prisma";

import {
  getLatencyStatsRaw,
  getReliabilityRaw,
  getSuccessRatesRaw,
  getThroughputStatsRaw,
  getTtftStatsRaw,
} from "@/services/metrics";

import ChartLatencyThroughputCost from "@/components/custom/chart-latency-throughput-cost";
import {
  DashboardFilters,
  ScopeTabs,
} from "@/components/custom/dashboard-components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---- helper: aggregate experiment accuracy from Trial.result JSON
async function getExperimentAccuracySummary(experimentId?: string) {
  const trials = await prisma.trial.findMany({
    where: experimentId ? { experimentId } : undefined,
    select: {
      modelId: true,
      promptMode: true,
      unitTool: true,
      driftCase: true,
      result: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const byModel = new Map<string, Array<any>>();
  for (const t of trials) {
    if (!t.result || typeof t.result !== "object") continue;
    byModel.set(t.modelId, [...(byModel.get(t.modelId) ?? []), t.result]);
  }

  const rows = [...byModel.entries()].map(([modelId, arr]) => {
    const num = arr.length || 1;
    const mean = (k: string) =>
      arr.reduce((s, r) => (typeof r?.[k] === "number" ? s + r[k] : s), 0) /
      num;

    return {
      modelId,
      count: arr.length,
      f1: mean("f1"),
      precision: mean("precision"),
      recall: mean("recall"),
      typeAcc: mean("typeAcc"),
      unitAcc: mean("unitAcc"),
      validRowsPct: mean("validRowsPct"),
    };
  });

  rows.sort((a, b) => (b.f1 ?? 0) - (a.f1 ?? 0));
  return rows;
}

type SearchParams = {
  tab?: "chat" | "experiments";
  expId?: string;
  modelId?: string;
  tag?: string;
  days?: string; // number as string
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // ---- read filters from URL (keeps SSR, no client state needed)
  const tab = (await searchParams).tab === "chat" ? "chat" : "experiments";
  const expId = (await searchParams).expId || undefined;
  const modelId = (await searchParams).modelId || undefined;
  const tag = (await searchParams).tag || undefined;
  const windowDays = Number.isFinite(Number((await searchParams).days))
    ? Math.max(1, Math.min(90, Number((await searchParams).days)))
    : 7;

  // ---- options for interactive filters
  const [experimentsList, modelsList] = await Promise.all([
    prisma.experiment.findMany({
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.modelRun.findMany({
      distinct: ["modelId"],
      select: { modelId: true },
      orderBy: { modelId: "asc" },
    }),
  ]);
  type Option = {
    value: string;
    label: string;
  };
  const experimentOptions: Option[] = experimentsList.map((e) => ({
    value: e.id,
    label: e.name ?? e.id,
  }));
  const modelOptions: Option[] = modelsList.map((m) => ({
    value: m.modelId,
    label: m.modelId,
  }));

  // ---- metric opts
  const chatOpts = { scope: "chat" as const, windowDays, tag, modelId };
  const expOpts = expId
    ? {
        scope: "experiment" as const,
        windowDays,
        tag,
        modelId,
        experimentId: expId,
      }
    : { scope: "experiment" as const, windowDays, tag, modelId };

  // ---- fetch both slices so switching tabs is instant
  const [
    succChat,
    succExp,
    latChat,
    latExp,
    ttftChat,
    ttftExp,
    thrChat,
    thrExp,
    relChat,
    relExp,
  ] = await Promise.all([
    getSuccessRatesRaw(chatOpts),
    getSuccessRatesRaw(expOpts),
    getLatencyStatsRaw(chatOpts),
    getLatencyStatsRaw(expOpts),
    getTtftStatsRaw(chatOpts),
    getTtftStatsRaw(expOpts),
    getThroughputStatsRaw(chatOpts),
    getThroughputStatsRaw(expOpts),
    getReliabilityRaw(chatOpts),
    getReliabilityRaw(expOpts),
  ]);

  // ---- header counters (global)
  const [datasetFiles, validations, specs, experiments, experimentTrials] =
    await Promise.all([
      prisma.datasetFile.count(),
      prisma.validationRun.count(),
      prisma.spec.count(),
      prisma.experiment.count(),
      prisma.trial.count(),
    ]);

  // ---- accuracy table rows (exp-only; filter by expId if provided)
  const accuracyRows = await getExperimentAccuracySummary(expId);

  return (
    <div className="w-full p-6 space-y-5">
      <h1 className="text-xl font-bold">Dashboard</h1>

      {/* Interactive filters + URL-synced tab switch */}
      <DashboardFilters
        experiments={experimentOptions}
        models={modelOptions}
        className="mt-4"
      />
      <ScopeTabs className="mt-2" />

      {/* Cards row — shared counters */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-3xl">
              {tab === "chat" ? succChat[0]?.runs ?? 0 : succExp[0]?.runs ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {tab === "chat" ? "Chat runs" : "Experiment runs (perf)"}
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-3xl">{datasetFiles}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Files uploaded</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-3xl">{validations}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Validation runs</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-3xl">{specs}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Specs defined</p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-3xl">{experiments}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Experiment instances
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tab content — render by URL param so the page stays SSR */}
      {tab === "chat" ? (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <ChartReliabilityStats chartData={relChat} />
            <ChartLatencyStats chartData={latChat} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <ChartTtftStats chartData={ttftChat} />
            <ChartThroughputStats chartData={thrChat} />
          </div>
        </>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <ChartReliabilityStats chartData={relExp} />
            <ChartLatencyStats chartData={latExp} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <ChartLatencyThroughputCost latency={latExp} throughput={thrExp} />
            <ChartThroughputStats chartData={thrExp} />
          </div>

          {/* Accuracy (from Trial.result) */}
          <Card>
            <CardHeader>
              <CardTitle>
                Accuracy{" "}
                {expId ? `(experiment: ${expId})` : "(macro avg per model)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Trials</TableHead>
                    <TableHead className="text-right">F1</TableHead>
                    <TableHead className="text-right">Precision</TableHead>
                    <TableHead className="text-right">Recall</TableHead>
                    <TableHead className="text-right">Type&nbsp;Acc</TableHead>
                    <TableHead className="text-right">Unit&nbsp;Acc</TableHead>
                    <TableHead className="text-right">
                      Valid&nbsp;Rows&nbsp;%
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accuracyRows.map((r) => (
                    <TableRow key={r.modelId}>
                      <TableCell className="font-medium">{r.modelId}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(r.f1 ?? 0).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(r.precision ?? 0).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(r.recall ?? 0).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(r.typeAcc ?? 0).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(r.unitAcc ?? 0).toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number.isFinite(r.validRowsPct)
                          ? `${(100 * r.validRowsPct).toFixed(1)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {accuracyRows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground"
                      >
                        No experiment trials{" "}
                        {expId ? "for this experiment." : "yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
