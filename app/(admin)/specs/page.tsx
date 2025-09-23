import { SpecsTable } from "@/components/custom/specs-table";
import prisma from "@/lib/prisma";

export default async function SpecsPage() {
  const specs = await prisma.spec.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      version: true,
      domain: true,
      status: true,
      updatedAt: true,
    },
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Specs</h1>
      <SpecsTable
        items={specs.map((s) => ({
          id: s.id,
          name: s.name,
          version: s.version,
          domain: s.domain ?? "generic",
          status: s.status,
          updatedAt: s.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
