import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceManager } from "@/lib/session";
import { parseWorkspaceName } from "@/lib/workspace-name";

const patchSchema = z.object({
  orgId: z.string().min(1),
  name: z.unknown(),
});

export async function PATCH(req: Request) {
  try {
    const body = patchSchema.parse(await req.json());
    await requireWorkspaceManager(body.orgId);
    const parsed = parseWorkspaceName(body.name);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const org = await prisma.org.update({
      where: { id: body.orgId },
      data: { name: parsed.name },
      select: { id: true, name: true },
    });
    return NextResponse.json({ id: org.id, name: org.name });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}
