import { CreateExperimentSchema } from "@/app/(chat)/api/experiment/schema";
import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new ChatSDKError("bad_request:api", "Invalid JSON body");
    });

    const parsed = CreateExperimentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ChatSDKError(
        "bad_request:api",
        JSON.stringify(parsed.error.flatten())
      );
    }
    const input = parsed.data;

    // sanity existence
    const ds = await prisma.datasetFile.findUnique({
      where: { id: input.datasetFileId },
      select: { id: true },
    });
    if (!ds) throw new ChatSDKError("not_found:api", "DatasetFile not found");

    const spec = await prisma.spec.findUnique({
      where: { id: input.specId },
      select: { id: true },
    });
    if (!spec) throw new ChatSDKError("not_found:api", "Spec not found");

    const exp = await prisma.experiment.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        datasetFileId: input.datasetFileId,
        specId: input.specId,
        matrix: input.matrix as any,
      },
    });

    return NextResponse.json({ ok: true, experimentId: exp.id });
  } catch (e: any) {
    if (e instanceof ChatSDKError) return e.toResponse();
    // Prisma or unknown error → treat as database/log surface or offline
    const err =
      e?.code || e?.name?.includes?.("Prisma")
        ? new ChatSDKError("bad_request:database", e?.message ?? "DB error")
        : new ChatSDKError("offline:api", e?.message ?? "Unexpected error");
    return err.toResponse();
  }
}

export async function GET() {
  try {
    const list = await prisma.experiment.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        datasetFileId: true,
        specId: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ ok: true, experiments: list });
  } catch (e: any) {
    const err =
      e?.code || e?.name?.includes?.("Prisma")
        ? new ChatSDKError("bad_request:database", e?.message ?? "DB error")
        : new ChatSDKError("offline:api", e?.message ?? "Unexpected error");
    return err.toResponse();
  }
}
