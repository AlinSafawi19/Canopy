/*
  Warnings:

  - Added the required column `updatedAt` to the `ContentCategoryEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ContentCategoryEntry"
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ContentCategoryEntry_categoryId_updatedAt_idx" ON "ContentCategoryEntry"("categoryId", "updatedAt");
