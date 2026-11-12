import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { accountPatchForSessionUser } from "@/lib/account-settings";

function accountJson(user: { email: string; name: string | null; autosaveMs: number }) {
  return {
    email: user.email,
    name: user.name,
    autosaveMs: user.autosaveMs,
  };
}

export async function GET() {
  try {
    const sessionUser = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { email: true, name: true, autosaveMs: true },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(accountJson(user));
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const sessionUser = await requireUser();
    const raw = await req.json().catch(() => null);
    const planned = accountPatchForSessionUser(sessionUser.id, raw);
    if (!planned.ok) {
      return NextResponse.json({ error: planned.error }, { status: planned.status });
    }
    const user = await prisma.user.update({
      where: planned.where,
      data: planned.data,
      select: { email: true, name: true, autosaveMs: true },
    });
    return NextResponse.json(accountJson(user));
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
