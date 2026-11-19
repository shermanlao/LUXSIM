import { NextResponse } from "next/server";
import { z } from "zod";
import { assertNotLastOwner, assertNotLastSiteAdmin, isWorkspaceRole } from "@/lib/access-control";
import { loadAdminUser, serializeUser } from "@/lib/admin-users";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { countActiveSiteAdmins, countOrgOwners, requireSiteAdmin } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(80).nullable().optional(),
  isSiteAdmin: z.boolean().optional(),
  disabled: z.boolean().optional(),
  membership: z
    .object({
      orgId: z.string().min(1),
      role: z.enum(["owner", "member"]),
    })
    .optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireSiteAdmin();
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const nextAdmin = body.isSiteAdmin ?? user.isSiteAdmin;
    const nextDisabled = body.disabled ?? user.disabled;
    const activeAdminCount = await countActiveSiteAdmins();
    assertNotLastSiteAdmin({
      currentlyAdmin: user.isSiteAdmin,
      currentlyDisabled: user.disabled,
      activeAdminCount,
      nextAdmin,
      disabling: nextDisabled && !user.disabled ? true : undefined,
    });

    if (body.membership) {
      if (!isWorkspaceRole(body.membership.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      const org = await prisma.org.findUnique({ where: { id: body.membership.orgId } });
      if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      const existingMembership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: body.membership.orgId, userId: id } },
      });
      if (existingMembership?.role === "owner" && body.membership.role === "member") {
        assertNotLastOwner({
          currentlyOwner: true,
          ownerCount: await countOrgOwners(body.membership.orgId),
          nextRole: "member",
        });
      }
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId: body.membership.orgId, userId: id } },
        update: { role: body.membership.role },
        create: { orgId: body.membership.orgId, userId: id, role: body.membership.role },
      });
    }

    await prisma.user.update({
      where: { id },
      data: {
        name: body.name === undefined ? undefined : body.name,
        isSiteAdmin: body.isSiteAdmin,
        disabled: body.disabled,
      },
    });

    const updated = await loadAdminUser(id);
    return NextResponse.json(serializeUser(updated!));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}
