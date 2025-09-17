-- CreateTable
CREATE TABLE "public"."ModelRun" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userMessageId" TEXT NOT NULL,
    "assistantMessageId" TEXT,
    "modelId" TEXT NOT NULL,
    "tag" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "durationClientMs" INTEGER NOT NULL,
    "ttftMs" INTEGER,
    "durationServerMs" INTEGER,
    "stopped" BOOLEAN NOT NULL DEFAULT false,
    "disconnected" BOOLEAN NOT NULL DEFAULT false,
    "error" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelRun_pkey" PRIMARY KEY ("id")
);
