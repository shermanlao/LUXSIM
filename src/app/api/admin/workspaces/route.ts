import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireSiteAdmin } from "@/lib/session";

export async function GET() {
  try {
    await requireSiteAdmin();
    const orgs = await prisma.org.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, email: true, name: true, disabled: true } } },
        },
        projects: {
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, updatedAt: true, createdAt: true },
        },
        _count: { select: { luminaires: true } },
      },
    });
    return NextResponse.json(
      orgs.map((org) => ({
        id: org.id,
        name: org.name,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        luminaireCount: org._count.luminaires,
        members: org.members.map((m) => ({
          userId: m.user.id,
          email: m.user.email,
          name: m.user.name,
          disabled: m.user.disabled,
          role: m.role,
          createdAt: m.createdAt,
        })),
        projects: org.projects,
      }))
    );
  } catch (e) {
    return apiErrorResponse(e);
  }
}
