/*
  Warnings:

  - A unique constraint covering the columns `[chatId,datasetFileId]` on the table `ChatFile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[messageId,datasetFileId]` on the table `MessageFile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ChatFile_chatId_datasetFileId_key" ON "public"."ChatFile"("chatId", "datasetFileId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageFile_messageId_datasetFileId_key" ON "public"."MessageFile"("messageId", "datasetFileId");
