-- AlterTable: rename description → overview, coverImageAlt → thumbnail_alt
ALTER TABLE "Project" RENAME COLUMN "description" TO "overview";
ALTER TABLE "Project" RENAME COLUMN "coverImageAlt" TO "thumbnail_alt";
