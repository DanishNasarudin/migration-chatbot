import ChartLatencyStats from "@/components/custom/chart-latency-stats";
import ChartReliabilityStats from "@/components/custom/chart-reliability-stats";
import ChartThroughputStats from "@/components/custom/chart-throughput-stats";
import ChartTtftStats from "@/components/custom/chart-ttft-stats";
import prisma from "@/lib/prisma";
import {
  getLatencyStatsRaw,
  getReliabilityRaw,
  getSuccessRatesRaw,
  getThroughputStatsRaw,
  getTtftStatsRaw,
} from "@/services/metrics";

export default async function Page() {
  const succRates = await getSuccessRatesRaw();
  const latencyStats = await getLatencyStatsRaw();
  const ttftStats = await getTtftStatsRaw();
  const throughputStats = await getThroughputStatsRaw();
  const reliabilityStats = await getReliabilityRaw();

  const datasetFiles = (await prisma.datasetFile.findMany()).length;
  const validations = (await prisma.validationRun.findMany()).length;
  const specs = (await prisma.spec.findMany()).length;
  const experiments = (await prisma.experiment.findMany()).length;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <main className="space-y-4">
        <div className="flex gap-4">
          <div className="border border-border rounded-lg flex flex-col justify-center items-center px-8 py-4 w-full">
            <h1 className="text-3xl font-extrabold">{succRates[0].runs}</h1>
            <p className="whitespace-nowrap">Chat runs</p>
          </div>
          <div className="border border-border rounded-lg flex flex-col justify-center items-center px-8 py-4 w-full">
            <h1 className="text-3xl font-extrabold">{datasetFiles}</h1>
            <p className="whitespace-nowrap">Files uploaded</p>
          </div>
          <div className="border border-border rounded-lg flex flex-col justify-center items-center px-8 py-4 w-full">
            <h1 className="text-3xl font-extrabold">{validations}</h1>
            <p className="whitespace-nowrap">Validation runs</p>
          </div>
          <div className="border border-border rounded-lg flex flex-col justify-center items-center px-8 py-4 w-full">
            <h1 className="text-3xl font-extrabold">{specs}</h1>
            <p className="whitespace-nowrap">Specs defined</p>
          </div>
          <div className="border border-border rounded-lg flex flex-col justify-center items-center px-8 py-4 w-full">
            <h1 className="text-3xl font-extrabold">{experiments}</h1>
            <p className="whitespace-nowrap">Experiment instances</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="aspect-video w-full">
            <ChartReliabilityStats chartData={reliabilityStats} />
          </div>
          <div className="aspect-video w-full">
            <ChartLatencyStats chartData={latencyStats} />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="aspect-video w-full">
            <ChartTtftStats chartData={ttftStats} />
          </div>
          <div className="aspect-video w-full">
            <ChartThroughputStats chartData={throughputStats} />
          </div>
        </div>
      </main>
    </div>
  );
}
