-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100),
    "industry" VARCHAR(100),
    "description" VARCHAR(2000) NOT NULL,
    "videoBg" VARCHAR(500),
    "imageBg" VARCHAR(500),
    "categories" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "domain" VARCHAR(255),
    "host" VARCHAR(100),
    "adminTenantId" TEXT NOT NULL DEFAULT 'platform-default',
    "shortDescription" VARCHAR(200),
    "techStack" JSONB NOT NULL DEFAULT '[]',
    "githubUrl" VARCHAR(500),
    "liveUrl" VARCHAR(500),
    "role" VARCHAR(100),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'live',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "coverImageAlt" VARCHAR(200),
    "teamSize" VARCHAR(20),
    "highlights" TEXT[],

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCategory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100),
    "description" VARCHAR(500),
    "iconName" TEXT,
    "iconIndex" INTEGER,
    "defaults" JSONB,
    "fields" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "ContentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCategoryEntry" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "ContentCategoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "username" VARCHAR(30) NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "theme" VARCHAR(10) NOT NULL DEFAULT 'auto',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "slug" TEXT,
    "walkthroughSeenAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustShow2faReminder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ClientIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAssignment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,

    CONSTRAINT "ClientAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminIdentity" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "theme" VARCHAR(10) NOT NULL DEFAULT 'auto',
    "tenantId" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "walkthroughSeenAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustShow2faReminder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AdminIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformOwner" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "theme" VARCHAR(10) NOT NULL DEFAULT 'auto',
    "walkthroughSeenAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustShow2faReminder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlatformOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorBackupCode" (
    "id" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetChallenge" (
    "id" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationChallenge" (
    "id" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contributor" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(30) NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentClientUsername" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "theme" VARCHAR(10) NOT NULL DEFAULT 'auto',
    "accountId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "walkthroughSeenAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mustShow2faReminder" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Contributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "adminTenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributorAssignment" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceName" TEXT,
    "adminTenantId" TEXT,
    "parentClientUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Release" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Release_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");

-- CreateIndex
CREATE INDEX "Project_slug_idx" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_adminTenantId_idx" ON "Project"("adminTenantId");

-- CreateIndex
CREATE INDEX "ContentCategory_projectId_idx" ON "ContentCategory"("projectId");

-- CreateIndex
CREATE INDEX "ContentCategoryEntry_categoryId_idx" ON "ContentCategoryEntry"("categoryId");

-- CreateIndex
CREATE INDEX "ContentCategoryEntry_categoryId_archivedAt_idx" ON "ContentCategoryEntry"("categoryId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientIdentity_username_key" ON "ClientIdentity"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ClientIdentity_slug_key" ON "ClientIdentity"("slug");

-- CreateIndex
CREATE INDEX "ClientIdentity_tenantId_idx" ON "ClientIdentity"("tenantId");

-- CreateIndex
CREATE INDEX "ClientIdentity_tenantId_archivedAt_idx" ON "ClientIdentity"("tenantId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAssignment_projectId_key" ON "ClientAssignment"("projectId");

-- CreateIndex
CREATE INDEX "ClientAssignment_tenantId_idx" ON "ClientAssignment"("tenantId");

-- CreateIndex
CREATE INDEX "ClientAssignment_clientId_idx" ON "ClientAssignment"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminIdentity_username_key" ON "AdminIdentity"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminIdentity_email_key" ON "AdminIdentity"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminIdentity_tenantId_key" ON "AdminIdentity"("tenantId");

-- CreateIndex
CREATE INDEX "AdminIdentity_archivedAt_idx" ON "AdminIdentity"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOwner_username_key" ON "PlatformOwner"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOwner_email_key" ON "PlatformOwner"("email");

-- CreateIndex
CREATE INDEX "TwoFactorBackupCode_targetKind_targetId_idx" ON "TwoFactorBackupCode"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "PasswordResetChallenge_targetKind_targetId_idx" ON "PasswordResetChallenge"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "PasswordResetChallenge_expiresAt_idx" ON "PasswordResetChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailVerificationChallenge_targetKind_targetId_idx" ON "EmailVerificationChallenge"("targetKind", "targetId");

-- CreateIndex
CREATE INDEX "EmailVerificationChallenge_expiresAt_idx" ON "EmailVerificationChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "Contributor_tenantId_parentClientUsername_idx" ON "Contributor"("tenantId", "parentClientUsername");

-- CreateIndex
CREATE INDEX "Contributor_accountId_idx" ON "Contributor"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Contributor_tenantId_username_key" ON "Contributor"("tenantId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_projectId_idx" ON "ApiKey"("projectId");

-- CreateIndex
CREATE INDEX "ApiKey_adminTenantId_idx" ON "ApiKey"("adminTenantId");

-- CreateIndex
CREATE INDEX "ContributorAssignment_contributorId_idx" ON "ContributorAssignment"("contributorId");

-- CreateIndex
CREATE INDEX "ContributorAssignment_projectId_idx" ON "ContributorAssignment"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ContributorAssignment_contributorId_projectId_key" ON "ContributorAssignment"("contributorId", "projectId");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_adminTenantId_createdAt_idx" ON "ActivityLog"("adminTenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_parentClientUsername_createdAt_idx" ON "ActivityLog"("parentClientUsername", "createdAt");

-- CreateIndex
CREATE INDEX "Release_createdAt_idx" ON "Release"("createdAt");

-- AddForeignKey
ALTER TABLE "ContentCategory" ADD CONSTRAINT "ContentCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCategoryEntry" ADD CONSTRAINT "ContentCategoryEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAssignment" ADD CONSTRAINT "ClientAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributorAssignment" ADD CONSTRAINT "ContributorAssignment_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "Contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
