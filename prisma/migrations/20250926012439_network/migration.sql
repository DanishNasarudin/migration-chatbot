/*
  Warnings:

  - You are about to drop the `TelemetryEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Experiment" ADD COLUMN     "seed" INTEGER,
ADD COLUMN     "status" "public"."ExperimentStatus" NOT NULL DEFAULT 'queue';

-- AlterTable
ALTER TABLE "public"."Trial" ADD COLUMN     "seed" INTEGER;

-- DropTable
DROP TABLE "public"."TelemetryEvent";

-- CreateTable
CREATE TABLE "public"."NetworkEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkEvent_runId_idx" ON "public"."NetworkEvent"("runId");
