import ChartLatencyStats from "@/components/custom/chart-latency-stats";
import ChartReliabilityStats from "@/components/custom/chart-reliability-stats";
import ChartThroughputStats from "@/components/custom/chart-throughput-stats";
import ChartTtftStats from "@/components/custom/chart-ttft-stats";
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

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>
      <main className="space-y-4">
        <div className="flex gap-4">
          <div className="border border-border rounded-lg flex flex-col justify-center items-center px-8 py-4 w-min">
            <h1 className="text-3xl font-extrabold">{succRates[0].runs}</h1>
            <p>Runs</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="aspect-video w-[500px]">
            <ChartReliabilityStats chartData={reliabilityStats} />
          </div>
          <div className="aspect-video w-[500px]">
            <ChartLatencyStats chartData={latencyStats} />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="aspect-video w-[500px]">
            <ChartTtftStats chartData={ttftStats} />
          </div>
          <div className="aspect-video w-[500px]">
            <ChartThroughputStats chartData={throughputStats} />
          </div>
        </div>
      </main>
    </div>
  );
}
