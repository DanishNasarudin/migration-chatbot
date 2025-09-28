"use client";
import { SuccessRateRow } from "@/services/metrics";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { ChartConfig, ChartContainer } from "../ui/chart";

const chartConfig = {
  successRate: {
    label: "Success Rate",
    color: "#2563eb",
  },
} satisfies ChartConfig;

type ChartData = SuccessRateRow;

export default function ChartSuccessRate({
  chartData,
}: {
  chartData: ChartData[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Success Rate</CardTitle>
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
            <Bar dataKey="successRate" fill="var(--color-primary)" radius={4}>
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
