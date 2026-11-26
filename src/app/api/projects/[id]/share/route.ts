import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireUser } from "@/lib/session";
import { ensureProjectShareToken } from "@/lib/load-public-share";
import { parseShareLinksEnabled, projectShareUrl, publicShareAllowed } from "@/lib/project-share";

type Params = { params: Promise<{ id: string }> };

function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwarded = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = forwarded ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

async function sharePayload(req: Request, projectId: string) {
  const sessionUser = await requireUser();
  const { project } = await requireProjectAccess(projectId);
  const token = project.shareEnabled ? await ensureProjectShareToken(project.id) : project.shareToken;
  const fresh = await prisma.project.findUnique({
    where: { id: project.id },
    select: { shareEnabled: true, shareToken: true, orgId: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { shareLinksEnabled: true },
  });
  const owners = await prisma.orgMember.findMany({
    where: { orgId: fresh?.orgId ?? project.orgId, role: "owner" },
    include: { user: { select: { shareLinksEnabled: true } } },
  });
  const accountEnabled = user?.shareLinksEnabled ?? true;
  const enabled = publicShareAllowed({
    projectShareEnabled: fresh?.shareEnabled ?? true,
    ownerShareLinksEnabled: owners.map((o) => o.user.shareLinksEnabled),
  }) && accountEnabled;
  const shareToken = fresh?.shareToken ?? token ?? null;
  return {
    enabled: fresh?.shareEnabled ?? true,
    accountEnabled,
    public: enabled && !!shareToken,
    url:
      enabled && shareToken
        ? projectShareUrl(requestOrigin(req), shareToken)
        : null,
  };
}

export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    return NextResponse.json(await sharePayload(req, id));
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    await requireProjectAccess(id);
    const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
    const parsed = parseShareLinksEnabled(body?.enabled);
    if (parsed == null) {
      return NextResponse.json({ error: "Invalid view-only link setting" }, { status: 400 });
    }
    await prisma.project.update({
      where: { id },
      data: { shareEnabled: parsed },
    });
    if (parsed) await ensureProjectShareToken(id);
    return NextResponse.json(await sharePayload(req, id));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
