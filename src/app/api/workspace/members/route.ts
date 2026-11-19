import { NextResponse } from "next/server";
import { z } from "zod";
import { canSeeWorkspaceMembersPage } from "@/lib/access-control";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { getUserMemberships, requireUser, requireWorkspaceManager } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const memberships = await getUserMemberships(user.id);
    const owned = memberships.filter((m) => m.role === "owner");
    if (!canSeeWorkspaceMembersPage(owned.length > 0)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = new URL(req.url);
    const requestedOrgId = url.searchParams.get("orgId");
    const selected = requestedOrgId
      ? owned.find((m) => m.orgId === requestedOrgId)
      : owned[0];
    if (requestedOrgId && !selected) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const orgId = selected!.orgId;
    const members = await prisma.orgMember.findMany({
      where: { orgId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, email: true, name: true, disabled: true } } },
    });
    return NextResponse.json({
      workspaces: owned.map((m) => ({ id: m.org.id, name: m.org.name })),
      orgId,
      orgName: selected!.org.name,
      members: members.map((m) => ({
        userId: m.user.id,
        email: m.user.email,
        name: m.user.name,
        disabled: m.user.disabled,
        role: m.role,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

const addSchema = z.object({
  orgId: z.string().min(1).optional(),
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = addSchema.parse(await req.json());
    const memberships = await getUserMemberships(user.id);
    const owned = memberships.filter((m) => m.role === "owner");
    const orgId = body.orgId ?? owned[0]?.orgId;
    if (!orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await requireWorkspaceManager(orgId);

    const target = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!target) return NextResponse.json({ error: "No account with that email" }, { status: 404 });

    const existing = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: target.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "User is already a member of this workspace" }, { status: 409 });
    }
    const member = await prisma.orgMember.create({
      data: { orgId, userId: target.id, role: body.role },
    });
    return NextResponse.json({
      userId: target.id,
      email: target.email,
      name: target.name,
      disabled: target.disabled,
      role: member.role,
      createdAt: member.createdAt,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}
