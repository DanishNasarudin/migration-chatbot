import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import prisma from "@/lib/prisma";
import type { SpecDoc } from "@/types/spec";

export default async function SpecDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const spec = await prisma.spec.findUnique({
    where: { id: (await params).id },
    include: { fields: { orderBy: { name: "asc" } } },
  });
  if (!spec) {
    return <div className="p-6">Spec not found.</div>;
  }

  const raw = spec.raw as SpecDoc | null;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {spec.name}{" "}
          <span className="text-muted-foreground">· {spec.version}</span>
        </h1>
        <div className="text-sm text-muted-foreground">
          Domain: {spec.domain ?? "generic"} · Status: {spec.status} · Updated:{" "}
          {spec.updatedAt.toLocaleString()}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Fields</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-24">Nullable</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Regex</TableHead>
                <TableHead>Enum</TableHead>
                <TableHead className="w-24">Primary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spec.fields.map((f) => (
                <TableRow key={f.name}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell>{f.type}</TableCell>
                  <TableCell>{f.nullable ? "true" : "false"}</TableCell>
                  <TableCell>{f.unit ?? "—"}</TableCell>
                  <TableCell>{f.regex ?? "—"}</TableCell>
                  <TableCell>
                    {Array.isArray(f.enumVals) && f.enumVals.length
                      ? f.enumVals.join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>{f.isPrimary ? "true" : "false"}</TableCell>
                </TableRow>
              ))}
              {spec.fields.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    No fields recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Raw Spec JSON</h2>
        <pre className="rounded-lg border bg-muted/30 p-4 text-xs overflow-x-auto">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </div>
    </div>
  );
}
