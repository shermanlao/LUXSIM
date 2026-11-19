import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { requireSiteAdmin } from "@/lib/session";
import { summarizeTrafficFromStore } from "@/lib/site-traffic";
import { prismaTrafficStore } from "@/lib/site-traffic-store";

export async function GET() {
  try {
    await requireSiteAdmin();
    return NextResponse.json(await summarizeTrafficFromStore(prismaTrafficStore));
  } catch (e) {
    return apiErrorResponse(e);
  }
}
