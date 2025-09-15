-- CreateTable
CREATE TABLE "public"."DatasetFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" VARCHAR(64) NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatasetFile_checksumSha256_idx" ON "public"."DatasetFile"("checksumSha256");

-- CreateIndex
CREATE INDEX "DatasetFile_mimeType_idx" ON "public"."DatasetFile"("mimeType");
