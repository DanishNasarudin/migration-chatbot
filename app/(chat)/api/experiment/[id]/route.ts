import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // disable route caching

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const done = await prisma.trial.count({
      where: { experimentId: (await params).id },
    });
    return NextResponse.json({ done }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "err" }, { status: 500 });
  }
}
