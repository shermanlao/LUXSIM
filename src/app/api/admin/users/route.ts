import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { isWorkspaceRole } from "@/lib/access-control";
import { loadAdminUser, serializeUser, userAdminInclude } from "@/lib/admin-users";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/session";
import { getSiteSettings } from "@/lib/site-settings";
import { generateTemporaryPassword } from "@/lib/temporary-password";

export async function GET() {
  try {
    await requireSiteAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: userAdminInclude,
    });
    return NextResponse.json(users.map(serializeUser));
  } catch (e) {
    return apiErrorResponse(e);
  }
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80).optional(),
  orgId: z.string().min(1).optional(),
  role: z.enum(["owner", "member"]).optional(),
  orgName: z.string().min(1).max(80).optional(),
  isSiteAdmin: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await requireSiteAdmin();
    const body = createSchema.parse(await req.json());
    const email = body.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    if (body.orgId) {
      const org = await prisma.org.findUnique({ where: { id: body.orgId } });
      if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const role = body.role && isWorkspaceRole(body.role) ? body.role : "owner";
    const settings = await getSiteSettings();
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const name = body.name ?? email.split("@")[0];

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        autosaveMs: settings.defaultAutosaveMs,
        isSiteAdmin: Boolean(body.isSiteAdmin),
      },
    });

    if (body.orgId) {
      await prisma.orgMember.create({
        data: { orgId: body.orgId, userId: user.id, role },
      });
    } else {
      await prisma.org.create({
        data: {
          name: body.orgName ?? `${name}'s workspace`,
          members: { create: { userId: user.id, role: "owner" } },
        },
      });
    }

    const created = await loadAdminUser(user.id);
    return NextResponse.json({
      ...serializeUser(created!),
      temporaryPassword,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e, "Failed to create user");
  }
}
