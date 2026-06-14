/*
  Warnings:

  - You are about to drop the column `imageBg` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `videoBg` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "imageBg",
DROP COLUMN "videoBg",
ADD COLUMN     "thumbnail_image" VARCHAR(500),
ADD COLUMN     "thumbnail_type" VARCHAR(10),
ADD COLUMN     "thumbnail_video" VARCHAR(500);
