-- CreateTable "PendingTwoFactorSetup"
CREATE TABLE "PendingTwoFactorSetup" (
    "id" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingTwoFactorSetup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingTwoFactorSetup_targetKind_targetId_key" ON "PendingTwoFactorSetup"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "PendingTwoFactorSetup_expiresAt_idx" ON "PendingTwoFactorSetup"("expiresAt");

-- CreateTable "AccountLock"
CREATE TABLE "AccountLock" (
    "id" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountLock_targetKind_targetId_key" ON "AccountLock"("targetKind", "targetId");
