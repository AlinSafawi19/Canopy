-- AlterTable: rename displayName → name, add rep fields
ALTER TABLE "ClientIdentity" RENAME COLUMN "displayName" TO "name";
ALTER TABLE "ClientIdentity" ALTER COLUMN "name" TYPE VARCHAR(100);
ALTER TABLE "ClientIdentity" ADD COLUMN "representativeName" VARCHAR(100);
ALTER TABLE "ClientIdentity" ADD COLUMN "representativeDesignation" VARCHAR(100);
