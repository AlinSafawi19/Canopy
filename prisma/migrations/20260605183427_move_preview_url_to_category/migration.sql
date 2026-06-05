/*
  Warnings:

  - You are about to drop the column `previewUrl` on the `Project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ContentCategory" ADD COLUMN     "previewUrl" VARCHAR(500);

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "previewUrl";
