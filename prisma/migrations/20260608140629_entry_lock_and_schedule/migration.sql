-- Entry locking and scheduled publishing fields
ALTER TABLE "ContentCategoryEntry"
  ADD COLUMN "lockedBy"     TEXT,
  ADD COLUMN "lockedByName" TEXT,
  ADD COLUMN "lockedUntil"  TIMESTAMP(3),
  ADD COLUMN "publishAt"    TIMESTAMP(3),
  ADD COLUMN "archiveAt"    TIMESTAMP(3);

CREATE INDEX "ContentCategoryEntry_publishAt_idx" ON "ContentCategoryEntry"("publishAt");
CREATE INDEX "ContentCategoryEntry_archiveAt_idx" ON "ContentCategoryEntry"("archiveAt");
