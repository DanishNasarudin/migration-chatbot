import { RunExperimentSchema } from "@/app/(chat)/api/experiment/schema";
import { ChatSDKError } from "@/lib/errors";
import { runExperiment } from "@/services/experiment";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new ChatSDKError("bad_request:api", "Invalid JSON body");
    });

    const parsed = RunExperimentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ChatSDKError(
        "bad_request:api",
        JSON.stringify(parsed.error.flatten())
      );
    }
    const input = parsed.data;

    const summary = await runExperiment(input.experimentId, {
      concurrency: input.concurrency ?? 1,
      dryRun: input.dryRun ?? false,
    });

    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    if (e instanceof ChatSDKError) return e.toResponse();
    const err =
      e?.code || e?.name?.includes?.("Prisma")
        ? new ChatSDKError("bad_request:database", e?.message ?? "DB error")
        : new ChatSDKError("offline:api", e?.message ?? "Unexpected error");
    return err.toResponse();
  }
}
