/*
  Warnings:

  - You are about to drop the `NetworkEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."NetworkEvent" DROP CONSTRAINT "NetworkEvent_runId_fkey";

-- DropTable
DROP TABLE "public"."NetworkEvent";

-- CreateTable
CREATE TABLE "public"."TelemetryEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "experimentId" TEXT,
    "trialId" TEXT,
    "runId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelemetryEvent_name_createdAt_idx" ON "public"."TelemetryEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEvent_experimentId_idx" ON "public"."TelemetryEvent"("experimentId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_trialId_idx" ON "public"."TelemetryEvent"("trialId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_runId_idx" ON "public"."TelemetryEvent"("runId");
