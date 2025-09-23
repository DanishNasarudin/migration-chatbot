import { ExperimentsTable } from "@/components/custom/experiments-table";
import { listChoices, listExperiments } from "@/services/experiment";

export default async function ExperimentsPage() {
  const [choices, items] = await Promise.all([
    listChoices(),
    listExperiments(),
  ]);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Experiments</h1>
      <ExperimentsTable items={items} choices={choices} />
    </div>
  );
}
