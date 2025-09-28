"use server";

import { Prisma } from "@/lib/generated/prisma";
import prisma from "@/lib/prisma";

type Scope = "chat" | "experiment" | "all";
export type MetricOpts = {
  scope?: Scope; // "chat" | "experiment" | "all"
  from?: Date; // optional time window start
  to?: Date; // optional time window end
  tagPrefix?: string; // e.g. "exp/schema:" to segment an experiment family
  modelIds?: string[]; // filter by models
};

function whereFor(opts?: MetricOpts) {
  const where: any = {};
  // Scope split based on how we tag experiment runs:
  //   experiment runner writes ModelRun.chatId = "exp:<experimentId>"
  if (opts?.scope === "experiment") {
    where.chatId = { startsWith: "exp:" };
  } else if (opts?.scope === "chat") {
    // chat runs = chatId null OR not starting with "exp:"
    where.OR = [{ chatId: null }, { chatId: { not: { startsWith: "exp:" } } }];
  }
  if (opts?.from || opts?.to) {
    where.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lt: opts.to } : {}),
    };
  }
  if (opts?.tagPrefix) {
    where.tag = { startsWith: opts.tagPrefix };
  }
  if (opts?.modelIds?.length) {
    where.modelId = { in: opts.modelIds };
  }
  return where;
}

function scopeFilter(scope: Scope | undefined, alias = '"ModelRun"') {
  if (scope === "experiment") {
    // experiment runs: we tag chatId as 'exp:<id>'
    return Prisma.sql` AND ${Prisma.raw(alias)}."chatId" LIKE 'exp:%'`;
  }
  if (scope === "chat") {
    // chat = chatId is NULL or not exp-prefixed
    return Prisma.sql` AND (${Prisma.raw(
      alias
    )}."chatId" IS NULL OR ${Prisma.raw(alias)}."chatId" NOT LIKE 'exp:%')`;
  }
  return Prisma.sql``; // 'all' → no-op
}

/** Common options */
type WindowOpts = {
  windowDays?: number; // default 7
  tag?: string | null; // optional filter
  tagPrefix?: string | null; // NEW — LIKE 'prefix%'
  tagLike?: string | null; // NEW — full LIKE pattern with % wildcards
  modelId?: string | null; // optional filter
  byTag?: boolean; // group by modelId + tag if true
  byModel?: boolean; // default true (group by model)
  scope?: Scope;
  experimentId?: string;
};
const def = <T>(v: T | undefined, d: T) => (v === undefined ? d : v);

/** Shared WHERE clause builder (keeps everything as Prisma.Sql) */
function whereClause(
  {
    windowDays = 7,
    tag,
    tagPrefix,
    tagLike,
    modelId,
    scope,
    experimentId,
  }: WindowOpts,
  alias = '"ModelRun"'
) {
  const parts: Prisma.Sql[] = [
    Prisma.sql`"createdAt" >= NOW() - (${windowDays}::int * INTERVAL '1 day')`,
  ];
  if (tag) parts.push(Prisma.sql`"tag" = ${tag}`);
  if (tagPrefix) parts.push(Prisma.sql`"tag" LIKE ${tagPrefix + "%"}`);
  if (tagLike) parts.push(Prisma.sql`"tag" LIKE ${tagLike}`);
  if (modelId) parts.push(Prisma.sql`"modelId" = ${modelId}`);

  if (experimentId) {
    parts.push(
      Prisma.sql`${Prisma.raw(alias)}."chatId" = ${`exp:${experimentId}`}`
    );
  } else if (scope === "experiment") {
    parts.push(Prisma.sql`${Prisma.raw(alias)}."chatId" LIKE 'exp:%'`);
  } else if (scope === "chat") {
    parts.push(
      Prisma.sql`(${Prisma.raw(alias)}."chatId" IS NULL OR ${Prisma.raw(
        alias
      )}."chatId" NOT LIKE 'exp:%')`
    );
  }
  return Prisma.sql`WHERE 1=1 AND ${Prisma.join(parts, ` AND `)}`;
}

/** SELECT + GROUP BY columns depending on byTag/byModel */
function groupCols(opts: WindowOpts) {
  const byModel = def(opts.byModel, true);
  const byTag = !!opts.byTag;

  const selectCols: Prisma.Sql[] = [];
  const groupCols: Prisma.Sql[] = [];

  if (byModel) {
    selectCols.push(Prisma.sql`"modelId"`);
    groupCols.push(Prisma.sql`"modelId"`);
  }
  if (byTag) {
    // Use COALESCE to avoid group-by null bucket label
    selectCols.push(Prisma.sql`COALESCE("tag",'—') AS tag`);
    groupCols.push(Prisma.sql`COALESCE("tag",'—')`);
  }

  return {
    select: selectCols.length
      ? Prisma.sql`${Prisma.join(selectCols, `, `)},`
      : Prisma.sql``,
    group: groupCols.length
      ? Prisma.sql`GROUP BY ${Prisma.join(groupCols, `, `)}`
      : Prisma.sql``,
  };
}

/* ========================= 1) Success Rate ========================= */

export type SuccessRateRow = {
  modelId: string;
  tag?: string;
  runs: number;
  success: number;
  successRate: number;
};

export async function getSuccessRatesRaw(opts: WindowOpts = {}) {
  const where = whereClause(opts);
  const cols = groupCols({ ...opts, byModel: def(opts.byModel, true) });

  const q = Prisma.sql`
    SELECT
      ${cols.select}
      COUNT(*)::int AS runs,
      SUM((NOT "error" AND NOT "stopped" AND NOT "disconnected")::int)::int AS success,
      AVG((NOT "error" AND NOT "stopped" AND NOT "disconnected")::int)::int AS "successRate"
    FROM "ModelRun"
    ${where}
    ${cols.group}
    ORDER BY "successRate" DESC;
  `;
  return prisma.$queryRaw<SuccessRateRow[]>(q);
}

/* ========================= 2) Latency (E2E) ========================= */

export type LatencyStatsRow = {
  modelId: string;
  tag?: string;
  runs: number;
  avgLatencyMs: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
};

export async function getLatencyStatsRaw(opts: WindowOpts = {}) {
  const where = whereClause(opts);
  const cols = groupCols({ ...opts, byModel: def(opts.byModel, true) });

  const q = Prisma.sql`
    SELECT
      ${cols.select}
      COUNT(*)::int AS runs,
      AVG("durationClientMs")::int AS "avgLatencyMs",
      percentile_disc(0.5)  WITHIN GROUP (ORDER BY "durationClientMs")::int AS "p50LatencyMs",
      percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationClientMs")::int AS "p95LatencyMs",
      percentile_disc(0.99) WITHIN GROUP (ORDER BY "durationClientMs")::int AS "p99LatencyMs"
    FROM "ModelRun"
    ${where}
    ${cols.group}
    ORDER BY "p95LatencyMs";
  `;
  return prisma.$queryRaw<LatencyStatsRow[]>(q);
}

/* ========================= 3) TTFT ========================= */

export type TtftStatsRow = {
  modelId: string;
  tag?: string;
  runsWithTtft: number;
  p50TtftMs: number | null;
  p95TtftMs: number | null;
  p99TtftMs: number | null;
};

export async function getTtftStatsRaw(opts: WindowOpts = {}) {
  const where = whereClause(opts);
  const cols = groupCols({ ...opts, byModel: def(opts.byModel, true) });

  const q = Prisma.sql`
    SELECT
      ${cols.select}
      COUNT("ttftMs")::int AS "runsWithTtft",
      percentile_disc(0.5)  WITHIN GROUP (ORDER BY "ttftMs") FILTER (WHERE "ttftMs" IS NOT NULL)::int  AS "p50TtftMs",
      percentile_disc(0.95) WITHIN GROUP (ORDER BY "ttftMs") FILTER (WHERE "ttftMs" IS NOT NULL)::int  AS "p95TtftMs",
      percentile_disc(0.99) WITHIN GROUP (ORDER BY "ttftMs") FILTER (WHERE "ttftMs" IS NOT NULL)::int  AS "p99TtftMs"
    FROM "ModelRun"
    ${where}
    ${cols.group}
    ORDER BY "p95TtftMs";
  `;
  const result = prisma.$queryRaw<TtftStatsRow[]>(q);
  return result;
}

/* ========================= 4) Throughput (tokens/sec) ========================= */

export type ThroughputRow = {
  modelId: string;
  tag?: string;
  runsWithOut: number;
  e2eTokPerSecAvg: number | null;
  e2eTokPerSecP50: number | null;
  e2eTokPerSecP95: number | null;
  genTokPerSecAvg: number | null;
  genTokPerSecP50: number | null;
  genTokPerSecP95: number | null;
  expansionRatioAvg: number | null;
};

export async function getThroughputStatsRaw(opts: WindowOpts = {}) {
  const where = whereClause(opts);
  const cols = groupCols({ ...opts, byModel: def(opts.byModel, true) });

  const q = Prisma.sql`
    WITH base AS (
      SELECT
        "modelId", COALESCE("tag",'—') AS tag,
        "durationClientMs","durationServerMs","ttftMs",
        "inputTokens","outputTokens"
      FROM "ModelRun"
      ${where}
    ), derived AS (
      SELECT
        ${def(opts.byModel, true) ? Prisma.sql`"modelId",` : Prisma.sql``}
        ${opts.byTag ? Prisma.sql`tag,` : Prisma.sql``}
        CASE
          WHEN "durationClientMs" > 0 AND "outputTokens" IS NOT NULL AND "outputTokens" > 0
          THEN ("outputTokens"::float / ("durationClientMs"/1000.0)) END AS e2e_tps,
        CASE
          WHEN "durationServerMs" IS NOT NULL
           AND ("durationServerMs" - COALESCE("ttftMs",0)) > 0
           AND "outputTokens" IS NOT NULL AND "outputTokens" > 0
          THEN ("outputTokens"::float / (("durationServerMs" - COALESCE("ttftMs",0))/1000.0)) END AS gen_tps,
        CASE WHEN COALESCE("inputTokens",0) > 0
          THEN ("outputTokens"::float / NULLIF("inputTokens",0)) END AS expand_ratio,
        ("outputTokens" IS NOT NULL AND "outputTokens" > 0)::int AS has_out
      FROM base
    )
    SELECT
      ${cols.select}
      SUM(has_out)::int AS "runsWithOut",
      AVG(e2e_tps) AS "e2eTokPerSecAvg",
      percentile_disc(0.5)  WITHIN GROUP (ORDER BY e2e_tps) FILTER (WHERE e2e_tps IS NOT NULL)  AS "e2eTokPerSecP50",
      percentile_disc(0.95) WITHIN GROUP (ORDER BY e2e_tps) FILTER (WHERE e2e_tps IS NOT NULL)  AS "e2eTokPerSecP95",
      AVG(gen_tps) AS "genTokPerSecAvg",
      percentile_disc(0.5)  WITHIN GROUP (ORDER BY gen_tps) FILTER (WHERE gen_tps IS NOT NULL)  AS "genTokPerSecP50",
      percentile_disc(0.95) WITHIN GROUP (ORDER BY gen_tps) FILTER (WHERE gen_tps IS NOT NULL)  AS "genTokPerSecP95",
      AVG(expand_ratio) AS "expansionRatioAvg"
    FROM derived
    ${cols.group}
    ORDER BY "e2eTokPerSecP95" DESC NULLS LAST;
  `;
  return prisma.$queryRaw<ThroughputRow[]>(q);
}

/* ========================= 5) Reliability breakdown ========================= */

export type ReliabilityRow = {
  modelId: string;
  tag?: string;
  runs: number;
  successRate: number;
  errorRate: number;
  stopRate: number;
  disconnectRate: number;
};

export async function getReliabilityRaw(opts: WindowOpts = {}) {
  const where = whereClause(opts);
  const cols = groupCols({ ...opts, byModel: def(opts.byModel, true) });

  const q = Prisma.sql`
    SELECT
      ${cols.select}
      COUNT(*)::int AS runs,
      AVG((NOT "error" AND NOT "stopped" AND NOT "disconnected")::int)::int AS "successRate",
      AVG(("error")::int)::int          AS "errorRate",
      AVG(("stopped")::int)::int        AS "stopRate",
      AVG(("disconnected")::int)::int   AS "disconnectRate"
    FROM "ModelRun"
    ${where}
    ${cols.group}
    ORDER BY "successRate" DESC;
  `;
  return prisma.$queryRaw<ReliabilityRow[]>(q);
}

/* ========================= 6) Network overhead ========================= */

export type NetworkOverheadRow = {
  modelId: string;
  tag?: string;
  avgOverheadMs: number | null;
  p50OverheadMs: number | null;
  p95OverheadMs: number | null;
};

export async function getNetworkOverheadRaw(opts: WindowOpts = {}) {
  const where = whereClause(opts);
  const cols = groupCols({ ...opts, byModel: def(opts.byModel, true) });

  const q = Prisma.sql`
    SELECT
      ${cols.select}
      AVG(GREATEST("durationClientMs" - COALESCE("durationServerMs","durationClientMs"), 0))::int AS "avgOverheadMs",
      percentile_disc(0.5)  WITHIN GROUP (ORDER BY GREATEST("durationClientMs" - COALESCE("durationServerMs","durationClientMs"), 0))::int  AS "p50OverheadMs",
      percentile_disc(0.95) WITHIN GROUP (ORDER BY GREATEST("durationClientMs" - COALESCE("durationServerMs","durationClientMs"), 0))::int  AS "p95OverheadMs"
    FROM "ModelRun"
    ${where}
    ${cols.group}
    ORDER BY "avgOverheadMs";
  `;
  return prisma.$queryRaw<NetworkOverheadRow[]>(q);
}

/* ========================= 7) Daily time series (p50/p95 latency & success) ========================= */

export type DailySeriesRow = {
  day: string; // ISO date
  modelId: string;
  tag?: string;
  runs: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  successRate: number;
};

export async function getDailySeriesRaw(opts: WindowOpts = {}) {
  const where = whereClause(opts);
  const byModel = def(opts.byModel, true);
  const byTag = !!opts.byTag;

  const dateCol = Prisma.sql`date_trunc('day', "createdAt")::date AS day`;
  const selectCols = [
    dateCol,
    ...(byModel ? [Prisma.sql`"modelId"`] : []),
    ...(byTag ? [Prisma.sql`COALESCE("tag",'—') AS tag`] : []),
  ];
  const groupColsArr = [
    Prisma.sql`day`,
    ...(byModel ? [Prisma.sql`"modelId"`] : []),
    ...(byTag ? [Prisma.sql`tag`] : []),
  ];

  const q = Prisma.sql`
    SELECT
      ${Prisma.join(selectCols, `, `)},
      COUNT(*)::int AS runs,
      percentile_disc(0.5)  WITHIN GROUP (ORDER BY "durationClientMs")::int AS "p50LatencyMs",
      percentile_disc(0.95) WITHIN GROUP (ORDER BY "durationClientMs")::int AS "p95LatencyMs",
      AVG((NOT "error" AND NOT "stopped" AND NOT "disconnected")::int)      AS "successRate"
    FROM "ModelRun"
    ${where}
    GROUP BY ${Prisma.join(groupColsArr, `, `)}
    ORDER BY day;
  `;
  return prisma.$queryRaw<DailySeriesRow[]>(q);
}
