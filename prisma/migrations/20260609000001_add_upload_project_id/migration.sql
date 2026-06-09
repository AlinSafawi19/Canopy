ALTER TABLE "Upload" ADD COLUMN "projectId" TEXT;

CREATE INDEX "Upload_projectId_idx" ON "Upload"("projectId");
