import { NextResponse } from "next/server";
import {
  clientIpFromHeaders,
  collectTrafficView,
  getTrafficSecret,
  VISITOR_COOKIE,
} from "@/lib/site-traffic";
import { prismaTrafficStore } from "@/lib/site-traffic-store";

function readPath(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const path = (body as { path?: unknown }).path;
  return typeof path === "string" ? path : "";
}

function existingVisitorId(cookieHeader: string | null): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
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

    const body = await req.json().catch(() => null);
    const outcome = await collectTrafficView({
      pathname: readPath(body),
      visitorId: existingVisitorId(req.headers.get("cookie")),
      ip: clientIpFromHeaders(req.headers),
      secret: getTrafficSecret(),
      store: prismaTrafficStore,
      secureCookie: process.env.NODE_ENV === "production",
    });

    const res = new NextResponse(null, { status: 204 });
    if (outcome.setCookie) {
      res.cookies.set(outcome.setCookie);
    }
    return res;
  } catch {
    console.error("[traffic] collect failed");
    return new NextResponse(null, { status: 204 });
  }
}
