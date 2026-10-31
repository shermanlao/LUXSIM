import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UI_TIPS } from "@/lib/ui-tips";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ helpKey: string }> }
) {
  const { helpKey } = await ctx.params;
  try {
    const tip = await prisma.uiTip.findUnique({ where: { helpKey } });
    if (tip) return NextResponse.json(tip);
  } catch {
    /* table may not exist yet — fall through */
  }
  const fallback = UI_TIPS.find((t) => t.helpKey === helpKey);
  if (!fallback) {
    return NextResponse.json({ error: "Tip not found" }, { status: 404 });
  }
  return NextResponse.json(fallback);
}
