import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getPublicSiteInfo } from "@/lib/site-settings";

/** Public report fields only (website for PDF footers). No admin settings. */
export async function GET() {
  try {
    return NextResponse.json(await getPublicSiteInfo());
  } catch (e) {
    return apiErrorResponse(e);
  }
}
