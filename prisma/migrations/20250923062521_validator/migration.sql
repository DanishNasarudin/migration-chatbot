-- CreateEnum
CREATE TYPE "public"."SpecStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateTable
CREATE TABLE "public"."DatasetProfile" (
    "id" TEXT NOT NULL,
    "datasetFileId" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "sampleHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Spec" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "domain" TEXT,
    "status" "public"."SpecStatus" NOT NULL DEFAULT 'draft',
    "raw" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpecField" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "nullable" BOOLEAN NOT NULL DEFAULT true,
    "unit" TEXT,
    "regex" TEXT,
    "enumVals" TEXT[],
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SpecField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ValidationRun" (
    "id" TEXT NOT NULL,
    "datasetFileId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "modelId" TEXT,
    "promptMode" TEXT,
    "unitTool" BOOLEAN NOT NULL DEFAULT false,
    "driftCase" TEXT,
    "passed" BOOLEAN NOT NULL,
    "metrics" JSONB NOT NULL,
    "profileHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ValidationIssue" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "colName" TEXT,
    "rowIndex" INTEGER,
    "value" TEXT,
    "expected" TEXT,
    "message" TEXT NOT NULL,

    CONSTRAINT "ValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Experiment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "datasetFileId" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "matrix" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Trial" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptMode" TEXT NOT NULL,
    "unitTool" BOOLEAN NOT NULL DEFAULT false,
    "driftCase" TEXT,
    "validationRunId" TEXT,
    "result" JSONB NOT NULL,

    CONSTRAINT "Trial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatasetProfile_datasetFileId_idx" ON "public"."DatasetProfile"("datasetFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Spec_name_version_key" ON "public"."Spec"("name", "version");

-- CreateIndex
CREATE INDEX "SpecField_specId_idx" ON "public"."SpecField"("specId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecField_specId_name_key" ON "public"."SpecField"("specId", "name");

-- CreateIndex
CREATE INDEX "ValidationRun_datasetFileId_idx" ON "public"."ValidationRun"("datasetFileId");

-- CreateIndex
CREATE INDEX "ValidationRun_specId_idx" ON "public"."ValidationRun"("specId");

-- CreateIndex
CREATE INDEX "ValidationRun_profileHash_idx" ON "public"."ValidationRun"("profileHash");

-- CreateIndex
CREATE INDEX "ValidationIssue_runId_idx" ON "public"."ValidationIssue"("runId");

-- CreateIndex
CREATE INDEX "Experiment_datasetFileId_idx" ON "public"."Experiment"("datasetFileId");

-- CreateIndex
CREATE INDEX "Experiment_specId_idx" ON "public"."Experiment"("specId");

-- CreateIndex
CREATE INDEX "Trial_experimentId_idx" ON "public"."Trial"("experimentId");

-- CreateIndex
CREATE INDEX "Trial_validationRunId_idx" ON "public"."Trial"("validationRunId");

-- AddForeignKey
ALTER TABLE "public"."DatasetProfile" ADD CONSTRAINT "DatasetProfile_datasetFileId_fkey" FOREIGN KEY ("datasetFileId") REFERENCES "public"."DatasetFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecField" ADD CONSTRAINT "SpecField_specId_fkey" FOREIGN KEY ("specId") REFERENCES "public"."Spec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationRun" ADD CONSTRAINT "ValidationRun_datasetFileId_fkey" FOREIGN KEY ("datasetFileId") REFERENCES "public"."DatasetFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationRun" ADD CONSTRAINT "ValidationRun_specId_fkey" FOREIGN KEY ("specId") REFERENCES "public"."Spec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ValidationIssue" ADD CONSTRAINT "ValidationIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "public"."ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Experiment" ADD CONSTRAINT "Experiment_datasetFileId_fkey" FOREIGN KEY ("datasetFileId") REFERENCES "public"."DatasetFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Experiment" ADD CONSTRAINT "Experiment_specId_fkey" FOREIGN KEY ("specId") REFERENCES "public"."Spec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trial" ADD CONSTRAINT "Trial_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "public"."Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trial" ADD CONSTRAINT "Trial_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "public"."ValidationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
