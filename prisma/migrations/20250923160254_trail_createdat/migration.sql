-- CreateEnum
CREATE TYPE "public"."ExperimentStatus" AS ENUM ('queue', 'running', 'completed');

-- AlterTable
ALTER TABLE "public"."Trial" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
