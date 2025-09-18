"use client";
import { TtftStatsRow } from "@/services/metrics";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
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
  runsWithTtft: {
    label: "Runs with TTFT",
    color: "#2563eb",
  },
  p95TtftMs: {
    label: "p95TtftMs",
    color: "#2563eb",
  },
} satisfies ChartConfig;

type ChartData = TtftStatsRow;

export default function ChartTtftStats({
  chartData,
}: {
  chartData: ChartData[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Time-to-first-token (TTFT)</CardTitle>
        <CardDescription></CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="modelId"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
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
            <Bar dataKey={"p95TtftMs"} fill="var(--color-primary)" radius={4}>
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
