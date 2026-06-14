/*
  Warnings:

  - You are about to drop the column `coverImageAlt` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Project` table. All the data in the column will be lost.
  - Added the required column `overview` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Project" DROP COLUMN "coverImageAlt",
DROP COLUMN "description",
ADD COLUMN     "overview" VARCHAR(2000) NOT NULL,
ADD COLUMN     "thumbnail_alt" VARCHAR(200);
