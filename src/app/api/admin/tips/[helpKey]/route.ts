import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/session";
import { UI_TIPS } from "@/lib/ui-tips";

type Params = { params: Promise<{ helpKey: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireSiteAdmin();
    const { helpKey } = await params;
    const seed = UI_TIPS.find((t) => t.helpKey === helpKey);
    const existing = await prisma.uiTip.findUnique({ where: { helpKey } });
    if (!seed && !existing) {
      return NextResponse.json({ error: "Tip not found" }, { status: 404 });
    }
    const body = patchSchema.parse(await req.json());
    const tip = await prisma.uiTip.upsert({
      where: { helpKey },
      update: { title: body.title, body: body.body },
      create: { helpKey, title: body.title, body: body.body },
    });
    return NextResponse.json(tip);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}
