import { ChatSDKError } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { metricSchema, PostRequestBody } from "./schema";

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = metricSchema.parse(json);
  } catch (error) {
    console.log(`Zod Error: ${error}`);
    return new ChatSDKError("bad_request:api").toResponse();
  }

  await prisma.modelRun.create({
    data: {
      ...requestBody,
      createdAt: new Date(requestBody.createdAt),
    },
  });

  return NextResponse.json({ ok: true });
}
