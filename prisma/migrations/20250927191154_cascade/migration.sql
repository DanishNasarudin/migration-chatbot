-- DropForeignKey
ALTER TABLE "public"."Trial" DROP CONSTRAINT "Trial_validationRunId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Trial" ADD CONSTRAINT "Trial_validationRunId_fkey" FOREIGN KEY ("validationRunId") REFERENCES "public"."ValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
