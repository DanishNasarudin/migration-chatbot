/*
  Warnings:

  - You are about to drop the column `seed` on the `Experiment` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Experiment` table. All the data in the column will be lost.
  - You are about to drop the column `seed` on the `Trial` table. All the data in the column will be lost.
  - You are about to drop the `NetworkEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Experiment" DROP COLUMN "seed",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "public"."Trial" DROP COLUMN "seed";

-- DropTable
DROP TABLE "public"."NetworkEvent";

-- DropEnum
DROP TYPE "public"."ExperimentStatus";

-- CreateTable
CREATE TABLE "public"."ExperimentRun" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "baseline" INTEGER NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentRun_pkey" PRIMARY KEY ("id")
);
