-- Drop lock columns if they still exist (already removed by 20260608_drop_entry_lock_fields in most envs)
ALTER TABLE "ContentCategoryEntry"
  DROP COLUMN IF EXISTS "lockedBy",
  DROP COLUMN IF EXISTS "lockedByName",
  DROP COLUMN IF EXISTS "lockedUntil";

-- Add requiresApproval if missing
ALTER TABLE "ContentCategoryEntry"
  ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- Drop the database-level default on updatedAt (Prisma manages this at the application level)
ALTER TABLE "ContentCategoryEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Create Webhook table if not already present
CREATE TABLE IF NOT EXISTS "Webhook" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "events" JSONB NOT NULL DEFAULT '["entry.created","entry.updated","entry.archived"]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastStatus" INTEGER,

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Webhook_categoryId_idx" ON "Webhook"("categoryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Webhook_categoryId_fkey'
  ) THEN
    ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AdminIdentity tenant scoping: FK back to the creating owner
ALTER TABLE "AdminIdentity" ADD COLUMN IF NOT EXISTS "createdByOwnerId" TEXT;

CREATE INDEX IF NOT EXISTS "AdminIdentity_createdByOwnerId_idx" ON "AdminIdentity"("createdByOwnerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AdminIdentity_createdByOwnerId_fkey'
  ) THEN
    ALTER TABLE "AdminIdentity" ADD CONSTRAINT "AdminIdentity_createdByOwnerId_fkey"
      FOREIGN KEY ("createdByOwnerId") REFERENCES "PlatformOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
