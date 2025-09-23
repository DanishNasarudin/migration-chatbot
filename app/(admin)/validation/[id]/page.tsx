import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import prisma from "@/lib/prisma";
import Link from "next/link";

type Issue = {
  severity: "info" | "warn" | "error";
  code: string;
  colName?: string | null;
  rowIndex?: number | null;
  value?: string | null;
  expected?: string | null;
  message: string;
};

export default async function ValidationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const run = await prisma.validationRun.findUnique({
    where: { id: (await params).id },
    include: {
      datasetFile: { select: { filename: true } },
      spec: { select: { id: true, name: true, version: true } },
      issues: true, // expects { severity, code, colName, rowIndex, value, expected, message }
    },
  });

  if (!run) return <div className="p-6">Validation run not found.</div>;

  const metrics = (run.metrics as any) ?? {};
  const schemaMatch = metrics.schemaMatch ?? {};
  const rows =
    metrics.validRows != null && metrics.totalRows != null
      ? `${metrics.validRows}/${metrics.totalRows}`
      : "—";

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          Validation #{run.id.slice(0, 8)}{" "}
          <span className={run.passed ? "text-green-600" : "text-red-600"}>
            · {run.passed ? "PASS" : "FAIL"}
          </span>
        </h1>
        <div className="text-sm text-muted-foreground">
          File: {run.datasetFile?.filename ?? "—"} · Spec:{" "}
          {run.spec ? (
            <Link
              href={`/specs/${run.spec.id}`}
              className="underline underline-offset-2"
            >
              {run.spec.name} · {run.spec.version}
            </Link>
          ) : (
            "—"
          )}{" "}
          · Unit tool: {run.unitTool ? "on" : "off"} · Created:{" "}
          {run.createdAt.toLocaleString()}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Metrics</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>F1</TableHead>
                <TableHead>Precision</TableHead>
                <TableHead>Recall</TableHead>
                <TableHead>Rows (valid/total)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="tabular-nums">
                  {schemaMatch.f1 != null ? schemaMatch.f1.toFixed(3) : "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {schemaMatch.precision != null
                    ? schemaMatch.precision.toFixed(3)
                    : "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {schemaMatch.recall != null
                    ? schemaMatch.recall.toFixed(3)
                    : "—"}
                </TableCell>
                <TableCell className="tabular-nums">{rows}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Issues</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Column</TableHead>
                <TableHead className="w-24">Row</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Expected</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.issues.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No issues.
                  </TableCell>
                </TableRow>
              ) : (
                run.issues.map((i, idx) => (
                  <TableRow key={idx}>
                    <TableCell
                      className={
                        i.severity === "error"
                          ? "text-red-600"
                          : i.severity === "warn"
                          ? "text-yellow-600"
                          : ""
                      }
                    >
                      {i.severity}
                    </TableCell>
                    <TableCell>{i.code}</TableCell>
                    <TableCell>{i.colName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">
                      {i.rowIndex ?? "—"}
                    </TableCell>
                    <TableCell className="truncate max-w-[18rem]">
                      {i.value ?? "—"}
                    </TableCell>
                    <TableCell className="truncate max-w-[18rem]">
                      {i.expected ?? "—"}
                    </TableCell>
                    <TableCell>{i.message}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Raw metrics JSON</h2>
        <pre className="rounded-lg border bg-muted/30 p-4 text-xs overflow-x-auto">
          {JSON.stringify(metrics, null, 2)}
        </pre>
      </div>
    </div>
  );
}
