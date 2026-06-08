-- CreateTable
CREATE TABLE "ChangeRequestComment" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeRequestComment_changeRequestId_createdAt_idx" ON "ChangeRequestComment"("changeRequestId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChangeRequestComment" ADD CONSTRAINT "ChangeRequestComment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
