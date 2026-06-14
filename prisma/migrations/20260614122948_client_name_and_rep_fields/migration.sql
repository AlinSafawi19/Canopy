/*
  Warnings:

  - You are about to drop the column `displayName` on the `ClientIdentity` table. All the data in the column will be lost.
  - Added the required column `name` to the `ClientIdentity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClientIdentity" DROP COLUMN "displayName",
ADD COLUMN     "name" VARCHAR(100) NOT NULL,
ADD COLUMN     "representativeDesignation" VARCHAR(100),
ADD COLUMN     "representativeName" VARCHAR(100);
