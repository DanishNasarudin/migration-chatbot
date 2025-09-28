"use client";

import { LatencyStatsRow, ThroughputRow } from "@/services/metrics";
import { useMemo } from "react";
import {
  CartesianGrid,
  Label,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../ui/chart";

/**
 * Bubble chart showing the latency ↔ throughput trade‑off with a cost overlay.
 *
 * X‑axis: Avg latency (ms)
 * Y‑axis: End‑to‑end tokens/sec (avg)
 * Bubble size: Cost basis (per 1k out tokens by default, or per request)
 */

const chartConfig = {
  latency: { label: "Avg latency (ms)", color: "#2563eb" },
  throughput: { label: "Tokens/sec (avg)", color: "#10b981" },
  cost: { label: "Cost basis", color: "#f59e0b" },
} satisfies ChartConfig;

export type PriceMap = Record<
  string,
  {
    /** USD per 1k input tokens */
    in: number;
    /** USD per 1k output tokens */
    out: number;
  }
>;

export type CostMode = "per1kOut" | "per1kIn" | "perRequest";

export default function ChartLatencyThroughputCost({
  latency,
  throughput,
  priceByModel = {},
  costMode = "per1kOut",
  /** Only used when costMode = "perRequest" */
  assumedInTokens = 300,
  /** Only used when costMode = "perRequest" */
  assumedOutTokens = 800,
}: {
  latency: LatencyStatsRow[];
  throughput: ThroughputRow[];
  priceByModel?: PriceMap;
  costMode?: CostMode;
  assumedInTokens?: number;
  assumedOutTokens?: number;
}) {
  const points = useMemo(() => {
    const tByModel = new Map<string, ThroughputRow>(
      throughput.map((t) => [t.modelId, t])
    );

    const costLabel =
      costMode === "per1kOut"
        ? "USD per 1k out"
        : costMode === "per1kIn"
        ? "USD per 1k in"
        : `USD per request (${assumedInTokens} in, ${assumedOutTokens} out)`;

    const rows = latency
      .map((l) => {
        const t = tByModel.get(l.modelId);
        if (!t) return null;

        const price = priceByModel[l.modelId];

        let cost: number | null = null;
        if (price) {
          if (costMode === "per1kOut") cost = price.out;
          else if (costMode === "per1kIn") cost = price.in;
          else if (costMode === "perRequest") {
            cost =
              (assumedInTokens / 1000) * price.in +
              (assumedOutTokens / 1000) * price.out;
          }
        }

        // Avoid zero-sized bubbles; use a tiny sentinel if cost unknown
        const bubble = cost ?? 0.01;

        return {
          modelId: l.modelId,
          avgLatencyMs: l.avgLatencyMs, // x
          e2eTokPerSecAvg: t.e2eTokPerSecAvg, // y
          cost: bubble, // z
          _costPretty: cost,
          _costLabel: costLabel,
        };
      })
      .filter(Boolean) as Array<{
      modelId: string;
      avgLatencyMs: number;
      e2eTokPerSecAvg: number;
      cost: number;
      _costPretty: number | null;
      _costLabel: string;
    }>;

    return rows;
  }, [
    latency,
    throughput,
    priceByModel,
    costMode,
    assumedInTokens,
    assumedOutTokens,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency × Throughput × Cost</CardTitle>
        <CardDescription>
          Bubble area encodes cost; hover for exact values.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full">
          <ScatterChart
            accessibilityLayer
            data={points}
            margin={{ top: 28, right: 12, bottom: 12, left: 12 }}
          >
            <CartesianGrid />
            <XAxis
              type="number"
              dataKey="avgLatencyMs"
              name="Avg latency"
              tickLine={false}
              axisLine={false}
            >
              <Label value="Avg latency (ms)" position="insideBottom" dy={12} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="e2eTokPerSecAvg"
              name="Tokens/sec"
              tickLine={false}
              axisLine={false}
            >
              <Label
                value="Tokens/sec (avg)"
                angle={-90}
                position="insideLeft"
                dx={-10}
              />
            </YAxis>
            {/* Bubble size; tune range to your dataset scale */}
            <ZAxis dataKey="cost" range={[40, 200]} name="Cost" />

            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  formatter={(_, _name, item) => {
                    const p = item?.payload as any;
                    if (!p) return null;
                    return (
                      <div className="space-y-1">
                        <div className="font-medium">{p.modelId}</div>
                        <div className="flex justify-between">
                          <span>Latency</span>
                          <span>{p.avgLatencyMs.toFixed(0)} ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Throughput</span>
                          <span>{p.e2eTokPerSecAvg.toFixed(2)} tok/s</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{p._costLabel}</span>
                          <span>
                            {p._costPretty == null
                              ? "n/a"
                              : `$${Number(p._costPretty).toFixed(4)}`}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              }
            />

            <Scatter
              name="Model"
              data={points}
              fill="var(--color-primary)"
              shape="circle"
            />
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
