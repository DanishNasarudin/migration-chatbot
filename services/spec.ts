"use server";

import { ChatSDKError } from "@/lib/errors";
import { Prisma, PrismaClient } from "@/lib/generated/prisma";
import { DefaultArgs } from "@/lib/generated/prisma/runtime/library";
import prisma from "@/lib/prisma";
import { toInputJson } from "@/lib/utils";
import { SpecDoc } from "@/types/spec";
import { revalidatePath } from "next/cache";

export async function persistSpecDoc(
  spec: SpecDoc,
  createdBy: string,
  onConflict: "error" | "bump"
) {
  return prisma.$transaction(async (tx) => {
    // Uniqueness guard: (name, version)
    let finalVersion = spec.version;
    const exists = await tx.spec.findUnique({
      where: {
        name_version: { name: spec.name, version: finalVersion } as any,
      },
    });

    if (exists) {
      if (onConflict === "error") {
        throw new ChatSDKError(
          "bad_request:api",
          `Spec "${spec.name}" version "${finalVersion}" already exists`
        );
      }
      // bump version until free
      finalVersion = await bumpUntilFree(tx, spec.name, finalVersion);
    }

    const created = await tx.spec.create({
      data: {
        name: spec.name,
        version: finalVersion,
        domain: spec.domain ?? "generic",
        status: "draft",
        raw: toInputJson(spec, finalVersion),
        createdBy,
      },
    });

    // normalize fields
    await tx.specField.createMany({
      data: spec.fields.map((f) => ({
        specId: created.id,
        name: f.name,
        type: f.type,
        nullable: f.nullable ?? true,
        unit: f.unit ?? null,
        regex: f.regex ?? null,
        enumVals: f.enumVals ?? [],
        isPrimary: !!f.isPrimary,
      })),
    });

    return created;
  });
}

async function bumpUntilFree(
  tx: Omit<
    PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
  >,
  name: string,
  baseVersion: string
): Promise<string> {
  // v1 -> v2, v10 -> v11, otherwise append -2 / -3 ...
  const m = baseVersion.match(/^v(\d+)(?:\.(\d+))?$/i);
  if (m) {
    let major = Number(m[1]);
    let minor = m[2] ? Number(m[2]) : undefined;
    while (true) {
      if (minor != null) minor++;
      else major++;
      const candidate = minor != null ? `v${major}.${minor}` : `v${major}`;
      const hit = await tx.spec.findUnique({
        where: { name_version: { name, version: candidate } as any },
      });
      if (!hit) return candidate;
    }
  } else {
    let i = 2;
    while (true) {
      const candidate = `${baseVersion}-${i}`;
      const hit = await tx.spec.findUnique({
        where: { name_version: { name, version: candidate } as any },
      });
      if (!hit) return candidate;
      i++;
    }
  }
}

export async function getSpecByFileId({
  name,
  version,
}: {
  name: string;
  version: string;
}) {
  try {
    const result = await prisma.spec.findFirst({
      where: {
        name,
        version,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return result;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get specs");
  }
}

export async function getSpecSummary(specId: string) {
  const spec = await prisma.spec.findUnique({
    where: { id: specId },
    include: { fields: true },
  });
  if (!spec) throw new Error("Spec not found");

  const raw = spec.raw as SpecDoc | null;
  const primaryKeys = raw?.keys?.primary ?? [];
  const uniques = raw?.keys?.unique ?? [];
  const previewFields = (raw?.fields ?? []).slice(0, 10).map((f) => ({
    name: f.name,
    type: f.type,
    nullable: f.nullable ?? true,
    unit: (f as any).unit ?? undefined,
  }));

  return {
    id: spec.id,
    name: spec.name,
    version: spec.version,
    domain: spec.domain ?? "generic",
    status: spec.status,
    updatedAt: spec.updatedAt.toISOString(),
    fieldCount: spec.fields.length,
    primaryKeys,
    uniquesCount: uniques.length,
    previewFields,
  };
}

export async function deleteSpec(specId: string) {
  await prisma.spec.delete({ where: { id: specId } });
  revalidatePath("/specs");
}
