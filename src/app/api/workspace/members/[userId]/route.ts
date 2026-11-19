import { NextResponse } from "next/server";
import { z } from "zod";
import { assertNotLastOwner } from "@/lib/access-control";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import {
  countOrgOwners,
  getUserMemberships,
  requireUser,
  requireWorkspaceManager,
} from "@/lib/session";

type Params = { params: Promise<{ userId: string }> };

async function orgIdForManager(explicit?: string | null): Promise<string> {
  if (explicit) return explicit;
  const user = await requireUser();
  const owned = (await getUserMemberships(user.id)).find((m) => m.role === "owner");
  if (!owned) throw new Error("FORBIDDEN");
  return owned.orgId;
}

const patchSchema = z.object({
  orgId: z.string().min(1).optional(),
  role: z.enum(["owner", "member"]),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { userId } = await params;
    const body = patchSchema.parse(await req.json());
    const orgId = await orgIdForManager(body.orgId);
    await requireWorkspaceManager(orgId);
    const membership = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
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

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { userId } = await params;
    const orgId = await orgIdForManager(new URL(req.url).searchParams.get("orgId"));
    await requireWorkspaceManager(orgId);
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
