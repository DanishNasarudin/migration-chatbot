"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrialRow =
  import("@/services/experiment").ExperimentDetail["trials"][number];

export function TrialsCharts({ trials }: { trials: TrialRow[] }) {
  const byModelF1 = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const t of trials) {
      if (typeof t.f1 === "number") {
        const m = map.get(t.modelId) ?? { sum: 0, n: 0 };
        m.sum += t.f1;
        m.n += 1;
        map.set(t.modelId, m);
      }
    }
    return Array.from(map.entries()).map(([model, v]) => ({
      model,
      avgF1: v.n ? v.sum / v.n : 0,
    }));
  }, [trials]);

  const byModelPass = useMemo(() => {
    const map = new Map<string, { pass: number; total: number }>();
    for (const t of trials) {
      const m = map.get(t.modelId) ?? { pass: 0, total: 0 };
      m.total += 1;
      if (t.passed) m.pass += 1;
      map.set(t.modelId, m);
    }
    return Array.from(map.entries()).map(([model, v]) => ({
      model,
      passRate: v.total ? v.pass / v.total : 0,
    }));
  }, [trials]);

  const byDriftPass = useMemo(() => {
    const map = new Map<string, { pass: number; total: number }>();
    for (const t of trials) {
      const k = t.driftCase ?? "none";
      const m = map.get(k) ?? { pass: 0, total: 0 };
      m.total += 1;
      if (t.passed) m.pass += 1;
      map.set(k, m);
    }
    return Array.from(map.entries()).map(([drift, v]) => ({
      drift,
      passRate: v.total ? v.pass / v.total : 0,
    }));
  }, [trials]);

  const f1OverTime = useMemo(() => {
    const items = trials
      .filter((t) => typeof t.f1 === "number")
      .map((t) => ({ ts: new Date(t.createdAt), f1: t.f1 as number }))
      .sort((a, b) => a.ts.getTime() - b.ts.getTime());
    // Bucket by minute to smooth, optional:
    return items.map((x) => ({ time: x.ts.toLocaleString(), f1: x.f1 }));
  }, [trials]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Average F1 by Model</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width={"100%"} height={"100%"}>
              <BarChart data={byModelF1}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" hide={false} />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                />
                <Legend />
                <Bar dataKey="avgF1" name="Avg F1" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pass Rate by Model</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width={"100%"} height={"100%"}>
              <BarChart data={byModelPass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                />
                <Legend />
                <Bar dataKey="passRate" name="Pass rate" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pass Rate by Drift Case</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width={"100%"} height={"100%"}>
              <BarChart data={byDriftPass}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="drift" />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                />
                <Legend />
                <Bar dataKey="passRate" name="Pass rate" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>F1 over Time</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width={"100%"} height={"100%"}>
              <LineChart data={f1OverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                />
                <Tooltip
                  formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                />
                <Legend />
                <Line type="monotone" dataKey="f1" name="F1" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
