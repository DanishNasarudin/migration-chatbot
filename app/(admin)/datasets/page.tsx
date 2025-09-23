import { DatasetsTable } from "@/components/custom/datasets-table";
import { DatasetsUpload } from "@/components/custom/datasets-upload";
import prisma from "@/lib/prisma";

export default async function DatasetsPage() {
  const files = await prisma.datasetFile.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      sizeBytes: true,
      createdAt: true,
    },
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Datasets</h1>
      <DatasetsUpload />
      <DatasetsTable
        items={files.map((f) => ({
          id: f.id,
          filename: f.filename,
          sizeBytes: f.sizeBytes ?? 0,
          createdAt: f.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
