import { ValidationTable } from "@/components/custom/validation-table";
import prisma from "@/lib/prisma";

type Row = {
  id: string;
  createdAt: string;
  passed: boolean;
  unitTool: boolean;
  datasetFile: { filename: string } | null;
  spec: { id: string; name: string; version: string } | null;
  metrics: {
    schemaMatch?: { precision?: number; recall?: number; f1?: number };
    validRows?: number;
    totalRows?: number;
  } | null;
};

export default async function ValidationIndexPage() {
  const runs = await prisma.validationRun.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      datasetFile: { select: { filename: true } },
      spec: { select: { id: true, name: true, version: true } },
    },
  });

  const items: Row[] = runs.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    passed: r.passed,
    unitTool: r.unitTool ?? false,
    datasetFile: r.datasetFile ? { filename: r.datasetFile.filename } : null,
    spec: r.spec
      ? { id: r.spec.id, name: r.spec.name, version: r.spec.version }
      : null,
    metrics: (r.metrics as any) ?? null,
  }));

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Validation Runs</h1>
      <ValidationTable items={items} />
    </div>
  );
}
