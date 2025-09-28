-- CreateTable
CREATE TABLE "public"."NetworkEvent" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT,
    "trialId" TEXT,
    "runId" TEXT,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "method" TEXT,
    "status" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,

    CONSTRAINT "NetworkEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkEvent_experimentId_idx" ON "public"."NetworkEvent"("experimentId");

-- CreateIndex
CREATE INDEX "NetworkEvent_trialId_idx" ON "public"."NetworkEvent"("trialId");

-- CreateIndex
CREATE INDEX "NetworkEvent_host_idx" ON "public"."NetworkEvent"("host");

-- AddForeignKey
ALTER TABLE "public"."NetworkEvent" ADD CONSTRAINT "NetworkEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."ModelRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
