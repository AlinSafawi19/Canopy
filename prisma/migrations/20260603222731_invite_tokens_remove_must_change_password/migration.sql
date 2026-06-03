-- AlterTable
ALTER TABLE "AdminIdentity" DROP COLUMN "mustChangePassword";

-- AlterTable
ALTER TABLE "ClientIdentity" DROP COLUMN "mustChangePassword";

-- AlterTable
ALTER TABLE "Contributor" DROP COLUMN "mustChangePassword";

-- AlterTable
ALTER TABLE "PlatformOwner" DROP COLUMN "mustChangePassword";

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_token_key" ON "InviteToken"("token");

-- CreateIndex
CREATE INDEX "InviteToken_token_idx" ON "InviteToken"("token");

-- CreateIndex
CREATE INDEX "InviteToken_targetKind_targetId_idx" ON "InviteToken"("targetKind", "targetId");
