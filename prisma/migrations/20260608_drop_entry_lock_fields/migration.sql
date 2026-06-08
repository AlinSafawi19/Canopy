ALTER TABLE "ContentCategoryEntry"
  DROP COLUMN IF EXISTS "lockedBy",
  DROP COLUMN IF EXISTS "lockedByName",
  DROP COLUMN IF EXISTS "lockedUntil";
