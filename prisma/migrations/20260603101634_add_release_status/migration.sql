-- AlterTable
ALTER TABLE "Release"
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- Back-fill existing rows then drop the default so Prisma manages it going forward
ALTER TABLE "Release" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Back-fill: existing releases that have no status were effectively published
UPDATE "Release" SET "status" = 'published', "publishedAt" = "createdAt" WHERE "status" = 'draft';

-- CreateIndex
CREATE INDEX "Release_status_idx" ON "Release"("status");
