import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/session";
import { UI_TIPS } from "@/lib/ui-tips";

export async function GET() {
  try {
    await requireSiteAdmin();
    const rows = await prisma.uiTip.findMany({ orderBy: { helpKey: "asc" } });
    const byKey = new Map(rows.map((r) => [r.helpKey, r]));
    const tips = UI_TIPS.map((seed) => {
      const row = byKey.get(seed.helpKey);
      return {
        helpKey: seed.helpKey,
        title: row?.title ?? seed.title,
        body: row?.body ?? seed.body,
        updatedAt: row?.updatedAt ?? null,
      };
    });
    for (const row of rows) {
      if (!UI_TIPS.some((s) => s.helpKey === row.helpKey)) {
        tips.push({
          helpKey: row.helpKey,
          title: row.title,
          body: row.body,
          updatedAt: row.updatedAt,
        });
      }
    }
    return NextResponse.json(tips);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
