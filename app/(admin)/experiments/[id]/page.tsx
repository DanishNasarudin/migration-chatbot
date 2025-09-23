import { TrialsCharts } from "@/components/custom/trials-charts";
import { TrialsTable } from "@/components/custom/trials-table";
import { getExperimentDetail } from "@/services/experiment";

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const detail = await getExperimentDetail((await params).id);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{detail.name}</h1>
        <div className="text-sm text-muted-foreground">
          Dataset: {detail.datasetLabel} · Spec: {detail.specLabel} · Created:{" "}
          {new Date(detail.createdAt).toLocaleString()}
        </div>
        <div className="text-sm">
          Combos:{" "}
          <span className="font-mono">{detail.matrix.combinations}</span> ·
          Trials: <span className="font-mono">{detail.trialsCount}</span> ·
          Passed: <span className="font-mono">{detail.passedCount}</span> ·
          Failed: <span className="font-mono">{detail.failedCount}</span>
        </div>
        {detail.description && <p className="text-sm">{detail.description}</p>}
      </div>
      <TrialsCharts trials={detail.trials} />
      <TrialsTable experimentId={detail.id} trials={detail.trials} />
    </div>
  );
}
