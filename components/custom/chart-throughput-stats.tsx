"use client";
import { ThroughputRow } from "@/services/metrics";
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
  runsWithOut: {
    label: "runsWithOut",
    color: "#2563eb",
  },
  e2eTokPerSecAvg: {
    label: "e2eTokPerSecAvg",
    color: "#2563eb",
  },
  expansionRatioAvg: {
    label: "expansionRatioAvg",
    color: "#2563eb",
  },
} satisfies ChartConfig;

type ChartData = ThroughputRow;

export default function ChartThroughputStats({
  chartData,
}: {
  chartData: ChartData[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Throughput Stats</CardTitle>
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
            <Bar dataKey={"runsWithOut"} fill="var(--color-primary)" radius={4}>
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
                formatter={(v: string) => Number(v).toFixed(2)}
              />
            </Bar>
            <Bar
              dataKey={"e2eTokPerSecAvg"}
              fill="var(--color-primary-foreground)"
              radius={4}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
                formatter={(v: string) => Number(v).toFixed(2)}
              />
            </Bar>
            <Bar
              dataKey={"expansionRatioAvg"}
              fill="var(--color-primary-foreground)"
              radius={4}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
                formatter={(v: string) => Number(v).toFixed(2)}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
