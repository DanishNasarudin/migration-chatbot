"use client";
import { LatencyStatsRow } from "@/services/metrics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  XAxis,
  YAxis,
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

const chartConfig = {
  avgLatencyMs: {
    label: "Avg Latency",
    color: "#2563eb",
  },
  p95LatencyMs: {
    label: "p95 Latency",
    color: "#2563eb",
  },
  p50LatencyMs: {
    label: "p50 Latency",
    color: "#2563eb",
  },
} satisfies ChartConfig;

type ChartData = LatencyStatsRow;

export default function ChartLatencyStats({
  chartData,
}: {
  chartData: ChartData[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Latency Stats</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 28, right: 8, bottom: 8, left: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="modelId"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis dataKey="avgLatencyMs" domain={[0, 1.05]} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => (
                    <div className="flex justify-between gap-4 w-full">
                      <div className="flex gap-2 items-center">
                        <div
                          className="w-[4px] h-full rounded-lg"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <p>{name}</p>
                      </div>
                      <p>{Number(value).toFixed(2)}</p>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey={"avgLatencyMs"}
              fill="var(--color-primary)"
              radius={4}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
            <Bar
              dataKey={"p95LatencyMs"}
              fill="var(--color-primary)"
              radius={4}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
            <Bar
              dataKey={"p50LatencyMs"}
              fill="var(--color-primary)"
              radius={4}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
