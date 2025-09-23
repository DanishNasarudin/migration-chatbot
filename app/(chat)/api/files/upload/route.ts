import prisma from "@/lib/prisma";
import { createFile } from "@/services/file";
import { profileDatasetFile } from "@/services/profile";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs"; // allows Node Buffer/crypto
export const dynamic = "force-dynamic"; // if you need it dynamic
export const maxDuration = 30; // Vercel safeguard, adjust as needed

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_BYTES = Number(process.env.MAX_FILE_BYTES ?? DEFAULT_MAX_BYTES);

// Explicit “data” file allowlist (ext + MIME)
const ALLOWED_EXTS = new Set([
  ".csv",
  ".txt",
  ".tsv",
  ".xls",
  ".xlsx",
  ".json",
  ".xml",
  ".parquet",
]);
const ALLOWED_MIME_EXACT = new Set([
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
  "application/xml",
  "application/x-parquet", // some parquet libs use this
  "application/octet-stream", // fallback for some tools
]);
// relaxed prefixes to catch “data-ish” types (json+xml vendor types, etc.)
const ALLOWED_MIME_PREFIXES = ["text/", "application/", "application/vnd."];

function getExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function isAllowed(file: File): boolean {
  const ext = getExtension(file.name);
  const type = (file.type || "").toLowerCase();

  // Accept explicit extensions
  if (ALLOWED_EXTS.has(ext)) return true;

  // Accept explicit exact MIME matches
  if (ALLOWED_MIME_EXACT.has(type)) return true;

  // Accept “data” leaning MIME families but not images/audio/video
  if (
    ALLOWED_MIME_PREFIXES.some((p) => type.startsWith(p)) &&
    !/(^image\/|^audio\/|^video\/)/.test(type)
  ) {
    return true;
  }
  return false;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Form field "file" is required.' },
      { status: 400 }
    );
  }

  if (!isAllowed(file)) {
    return NextResponse.json(
      {
        error:
          `Unsupported file type. Name="${file.name}" type="${file.type}". ` +
          `Allowed: CSV/TXT/Excel/JSON/XML/Parquet (and similar data MIME types).`,
      },
      { status: 415 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large. Limit is ${Math.floor(
          MAX_BYTES / (1024 * 1024)
        )}MB.`,
      },
      { status: 413 }
    );
  }

  const arrayBuffer = await file.arrayBuffer(); // Web standard
  const buf = Buffer.from(arrayBuffer); // Prisma Bytes expects Node Buffer

  const sha256 = createHash("sha256").update(buf).digest("hex");
  const ext = getExtension(file.name);

  // Optional: deduplicate by checksum
  const existing = await prisma.datasetFile.findFirst({
    where: { checksumSha256: sha256, sizeBytes: file.size },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      {
        url: `${process.env.HOSTNAME}/api/files/${existing.id}`,
        deduped: true,
        pathname: file.name,
        contentType: file.type,
        id: existing.id,
      },
      { status: 200 }
    );
  }

  const created = await createFile({
    fileName: file.name,
    extension: ext,
    fileType: file.type,
    sizeBytes: file.size,
    checksumSha256: sha256,
    data: buf,
  });

  const prof = await profileDatasetFile(created.id);
  const sampleHash = createHash("sha1")
    .update(
      JSON.stringify({
        rc: prof.rowCount,
        cols: prof.columns.map((c) => c.name),
      })
    )
    .digest("hex");

  const existingProfile = await prisma.datasetProfile.findFirst({
    where: {
      sampleHash,
    },
    select: {
      id: true,
    },
  });

  if (!existingProfile) {
    await prisma.datasetProfile.create({
      data: {
        datasetFileId: created.id,
        columns: prof.columns as any,
        rowCount: prof.rowCount,
        sampleHash,
      },
    });
  }

  return NextResponse.json(
    {
      url: `${process.env.HOSTNAME}/api/files/${created.id}`,
      pathname: created.filename,
      contentType: file.type,
      id: created.id,
    },
    { status: 201 }
  );
}
