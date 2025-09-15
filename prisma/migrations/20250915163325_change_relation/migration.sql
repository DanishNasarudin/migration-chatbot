/*
  Warnings:

  - You are about to drop the column `content` on the `Message` table. All the data in the column will be lost.
  - Made the column `parts` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."FilePurpose" AS ENUM ('input', 'output', 'other');

-- AlterTable
ALTER TABLE "public"."Message" DROP COLUMN "content",
ALTER COLUMN "parts" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."MessageFile" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "datasetFileId" TEXT NOT NULL,
    "label" TEXT,
    "purpose" "public"."FilePurpose" NOT NULL DEFAULT 'input',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatFile" (
    "chatId" TEXT NOT NULL,
    "datasetFileId" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "ChatFile_pkey" PRIMARY KEY ("chatId","datasetFileId")
);

-- CreateIndex
CREATE INDEX "MessageFile_messageId_idx" ON "public"."MessageFile"("messageId");

-- CreateIndex
CREATE INDEX "MessageFile_datasetFileId_idx" ON "public"."MessageFile"("datasetFileId");

-- CreateIndex
CREATE INDEX "ChatFile_datasetFileId_idx" ON "public"."ChatFile"("datasetFileId");

-- AddForeignKey
ALTER TABLE "public"."MessageFile" ADD CONSTRAINT "MessageFile_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MessageFile" ADD CONSTRAINT "MessageFile_datasetFileId_fkey" FOREIGN KEY ("datasetFileId") REFERENCES "public"."DatasetFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatFile" ADD CONSTRAINT "ChatFile_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatFile" ADD CONSTRAINT "ChatFile_datasetFileId_fkey" FOREIGN KEY ("datasetFileId") REFERENCES "public"."DatasetFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
