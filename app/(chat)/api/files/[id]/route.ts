import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const item = await prisma.datasetFile.findUnique({
    where: { id: (await params).id },
    select: { filename: true, mimeType: true, data: true },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const u8 =
    item.data instanceof Uint8Array
      ? item.data
      : new Uint8Array(
          (item.data as Buffer).buffer,
          (item.data as Buffer).byteOffset,
          (item.data as Buffer).byteLength
        );

  const ab = u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength
  ) as ArrayBuffer;

  return new NextResponse(ab, {
    headers: {
      "Content-Type": item.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        item.filename
      )}"`,
      "Content-Length": String(item.data.length),
    },
  });
}
