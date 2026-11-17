-- AlterTable
ALTER TABLE "User" ADD COLUMN "shareLinksEnabled" BOOLEAN NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "shareEnabled" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "Project" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");
