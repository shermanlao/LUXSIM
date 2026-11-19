import { NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

const addSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});

export async function POST(req: Request, { params }: Params) {
  try {
    await requireSiteAdmin();
    const { id: orgId } = await params;
    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    const body = addSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) return NextResponse.json({ error: "No account with that email" }, { status: 404 });
    const existing = await prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId: user.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "User is already a member of this workspace" }, { status: 409 });
    }
    const member = await prisma.orgMember.create({
      data: { orgId, userId: user.id, role: body.role },
    });
    return NextResponse.json({
      userId: user.id,
      email: user.email,
      name: user.name,
      disabled: user.disabled,
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
