import { NextResponse } from "next/server";
import { z } from "zod";
import { assertNotLastOwner } from "@/lib/access-control";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { countOrgOwners, requireSiteAdmin } from "@/lib/session";

type Params = { params: Promise<{ id: string; userId: string }> };

const patchSchema = z.object({
  role: z.enum(["owner", "member"]),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireSiteAdmin();
    const { id: orgId, userId } = await params;
    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = patchSchema.parse(await req.json());
    const ownerCount = await countOrgOwners(orgId);
    assertNotLastOwner({
      currentlyOwner: membership.role === "owner",
      ownerCount,
      nextRole: body.role,
    });
    const updated = await prisma.orgMember.update({
      where: { orgId_userId: { orgId, userId } },
      data: { role: body.role },
    });
    return NextResponse.json({ userId, role: updated.role });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireSiteAdmin();
    const { id: orgId, userId } = await params;
    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ownerCount = await countOrgOwners(orgId);
    assertNotLastOwner({
      currentlyOwner: membership.role === "owner",
      ownerCount,
      removing: true,
    });
    await prisma.orgMember.delete({ where: { orgId_userId: { orgId, userId } } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
