"use client";
import { ReliabilityRow } from "@/services/metrics";
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
  successRate: {
    label: "successRate",
    color: "#2563eb",
  },
  errorRate: {
    label: "errorRate",
    color: "#2563eb",
  },
  stopRate: {
    label: "stopRate",
    color: "#2563eb",
  },
  disconnectRate: {
    label: "disconnectRate",
    color: "#2563eb",
  },
} satisfies ChartConfig;

type ChartData = ReliabilityRow;

export default function ChartReliabilityStats({
  chartData,
}: {
  chartData: ChartData[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reliability Stats</CardTitle>
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
            <Bar dataKey={"successRate"} fill="var(--color-primary)" radius={4}>
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
                formatter={(v: string) => Number(v).toFixed(2)}
              />
            </Bar>
            <Bar
              dataKey={"errorRate"}
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
              dataKey={"stopRate"}
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
              dataKey={"disconnectRate"}
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
