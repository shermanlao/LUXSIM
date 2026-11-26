import { prisma } from "@/lib/prisma";
import type { DailyCounts, TrafficHit, TrafficStore } from "@/lib/site-traffic";

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code: string }).code === "P2002"
  );
}

export const prismaTrafficStore: TrafficStore = {
  async recordHit(hit: TrafficHit) {
    try {
      await prisma.siteTrafficVisitorDay.create({
        data: { date: hit.date, visitorHash: hit.visitorHash },
      });
      await prisma.siteTrafficDaily.upsert({
        where: { date: hit.date },
        create: { date: hit.date, pageViews: 1, visitors: 1 },
        update: { pageViews: { increment: 1 }, visitors: { increment: 1 } },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await prisma.siteTrafficDaily.upsert({
        where: { date: hit.date },
        create: { date: hit.date, pageViews: 1, visitors: 0 },
        update: { pageViews: { increment: 1 } },
      });
    }
  },

  async getDailyRange(fromDate, toDate) {
    const rows = await prisma.siteTrafficDaily.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      orderBy: { date: "asc" },
    });
    return rows.map((row): DailyCounts => ({
      date: row.date,
      visitors: row.visitors,
      pageViews: row.pageViews,
    }));
  },

  async countDistinctVisitors(fromDate, toDate) {
    const rows = await prisma.siteTrafficVisitorDay.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: { visitorHash: true },
      distinct: ["visitorHash"],
    });
    return rows.length;
  },
};
