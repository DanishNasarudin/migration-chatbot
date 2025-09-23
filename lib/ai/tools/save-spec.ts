import prisma from "@/lib/prisma";
import { profileDatasetFile } from "@/services/profile";
import { getSpecByFileId, persistSpecDoc } from "@/services/spec";
import { generateObject, tool } from "ai";
import { createHash } from "crypto";
import z from "zod/v3";
import { myProvider } from "../models";

const FieldSpecSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "boolean", "date"]),
  nullable: z.boolean().optional(),
  unit: z.string().optional(),
  enumVals: z.array(z.string()).optional(),
  regex: z.string().optional(),
  isPrimary: z.boolean().optional(),
  description: z.string().optional(),
});

const SpecDocSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  domain: z.enum(["finance", "healthcare", "ecommerce", "generic"]).optional(),
  fields: z.array(FieldSpecSchema).min(1),
  keys: z
    .object({
      primary: z.array(z.string()).optional(),
      unique: z.array(z.array(z.string())).optional(),
    })
    .optional(),
  relations: z
    .array(
      z.object({
        from: z.string(),
        toSpec: z.string(),
        toField: z.string(),
        onDelete: z.enum(["cascade", "restrict", "set_null"]).optional(),
      })
    )
    .optional(),
  examples: z.array(z.record(z.string(), z.unknown())).optional(),
  notes: z.string().optional(),
});
type SpecDoc = z.infer<typeof SpecDocSchema>;

// ---- Input & output
export type ProposeAndSaveSpecResult = {
  specId: string;
  name: string;
  version: string;
  status: "draft" | "active" | "archived";
};

export const saveSpec = tool({
  description:
    "Create a new Spec version from a dataset profile using structured AI output, then persist it. Returns { specId }.",
  inputSchema: z.object({
    fileId: z.string().cuid(),
    name: z.string().min(1).describe("Spec name taken exactly from 'filename'"),
    version: z.string().min(1).describe("Version of the Spec, (e.g. v1, v2)"),
    domain: z
      .enum(["finance", "healthcare", "ecommerce", "generic"])
      .default("generic"),
    createdBy: z.string().min(1),
    primaryKeyHint: z.array(z.string()).optional(),
    onConflict: z.enum(["error", "bump"]).default("error"),
  }),
  execute: async ({
    fileId: datasetFileId,
    name,
    version,
    domain,
    createdBy,
    primaryKeyHint,
    onConflict,
  }): Promise<ProposeAndSaveSpecResult> => {
    console.log("ai-tool: saveSpec called");

    // TODO: Need to create structureHash from profile, see if any difference, only then create new spec.
    const existing = await getSpecByFileId({ name, version });

    if (existing) {
      return {
        specId: existing.id,
        name: existing.name,
        version: existing.version,
        status: existing.status,
      };
    }

    // 1) Ensure profile (auto-profile if missing)
    let profile = await prisma.datasetProfile.findFirst({
      where: { datasetFileId },
      orderBy: { createdAt: "desc" },
    });
    if (!profile) {
      const p = await profileDatasetFile(datasetFileId);
      const sampleHash = createHash("sha1")
        .update(
          JSON.stringify({
            rc: p.rowCount,
            cols: p.columns.map((c) => c.name),
          })
        )
        .digest("hex");
      profile = await prisma.datasetProfile.create({
        data: {
          datasetFileId,
          columns: p.columns as any,
          rowCount: p.rowCount,
          sampleHash,
        },
      });
    }

    // 2) Generate SpecDoc (structured) from profile
    const { object } = await generateObject({
      model: myProvider.languageModel("qwen3:8b"),
      schema: SpecDocSchema,
      system:
        "You are a precise data architect. Produce a minimal, correct SpecDoc for validation. Keep names and types strict; set nullable=false when data is consistently present. Only output valid JSON per schema.",
      prompt: JSON.stringify({
        meta: { name, version, domain, primaryKeyHint },
        profile: {
          rowCount: (profile as any).rowCount,
          columns: (profile as any).columns,
        },
      }),
    });
    const draft = object as SpecDoc;

    // 3) Persist as a NEW spec version (status=draft), return specId
    const specRow = await persistSpecDoc(draft, createdBy, onConflict);
    return {
      specId: specRow.id,
      name: specRow.name,
      version: specRow.version,
      status: "draft",
    };
  },
});
