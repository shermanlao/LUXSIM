-- CreateTable
CREATE TABLE "SiteTrafficDaily" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "SiteTrafficVisitorDay" (
    "date" TEXT NOT NULL,
    "visitorHash" TEXT NOT NULL,

    PRIMARY KEY ("date", "visitorHash")
);
