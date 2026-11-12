import { NextResponse } from "next/server";
import {
  VISITOR_COOKIE,
  clientIpFromHeaders,
  getTrafficSecret,
  isValidVisitorId,
  newVisitorId,
  safeRecordPageView,
} from "@/lib/site-traffic";
import { prismaTrafficStore } from "@/lib/site-traffic-store";

function readPath(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const path = (body as { path?: unknown }).path;
  return typeof path === "string" ? path : "";
}

export async function POST(req: Request) {
  try {
    const origin = req.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== new URL(req.url).origin) {
          return new NextResponse(null, { status: 204 });
        }
      } catch {
        return new NextResponse(null, { status: 204 });
      }
    }

    const existing = req.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
      ?.slice(VISITOR_COOKIE.length + 1);
    const hadValidCookie = isValidVisitorId(existing);
    const visitorId = hadValidCookie ? existing : newVisitorId();

    const body = await req.json().catch(() => null);
    const pathname = readPath(body);

    await safeRecordPageView({
      pathname,
      visitorId,
      ip: clientIpFromHeaders(req.headers),
      secret: getTrafficSecret(),
      store: prismaTrafficStore,
    });

    const res = new NextResponse(null, { status: 204 });
    if (!hadValidCookie) {
      res.cookies.set({
        name: VISITOR_COOKIE,
        value: visitorId,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch {
    console.error("[traffic] collect failed");
    return new NextResponse(null, { status: 204 });
  }
}
