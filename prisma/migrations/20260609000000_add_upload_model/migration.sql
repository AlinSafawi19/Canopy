CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "gcsUrl" VARCHAR(1000) NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploaderRole" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Upload_gcsUrl_key" ON "Upload"("gcsUrl");

CREATE INDEX "Upload_uploadedBy_idx" ON "Upload"("uploadedBy");
