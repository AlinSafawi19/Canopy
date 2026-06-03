-- AlterTable
ALTER TABLE "AdminIdentity" ADD COLUMN     "lastSeenReleaseId" TEXT;

-- AlterTable
ALTER TABLE "ClientIdentity" ADD COLUMN     "lastSeenReleaseId" TEXT;

-- AlterTable
ALTER TABLE "Contributor" ADD COLUMN     "lastSeenReleaseId" TEXT;

-- AlterTable
ALTER TABLE "PlatformOwner" ADD COLUMN     "lastSeenReleaseId" TEXT;
