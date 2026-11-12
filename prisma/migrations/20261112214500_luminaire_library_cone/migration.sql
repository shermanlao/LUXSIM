-- AlterTable
ALTER TABLE "Luminaire" ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE "Luminaire" ADD COLUMN "libraryFamily" TEXT;
ALTER TABLE "Luminaire" ADD COLUMN "libraryBeamDeg" INTEGER;
