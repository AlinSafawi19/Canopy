-- AlterTable
ALTER TABLE "ChangeRequest" ADD COLUMN     "after" JSONB,
ADD COLUMN     "before" JSONB;
