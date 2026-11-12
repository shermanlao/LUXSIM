import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAutosaveMs } from "@/lib/account-settings";
import { apiErrorResponse } from "@/lib/api-error";
import { requireSiteAdmin } from "@/lib/session";
import { getSiteSettings, parsePublicRegistration, setSiteSettings } from "@/lib/site-settings";

export async function GET() {
  try {
    await requireSiteAdmin();
    return NextResponse.json(await getSiteSettings());
  } catch (e) {
    return apiErrorResponse(e);
  }
}

const patchSchema = z.object({
  publicRegistration: z.union([z.boolean(), z.string()]).optional(),
  defaultAutosaveMs: z.union([z.number(), z.string()]).optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireSiteAdmin();
    const body = patchSchema.parse(await req.json());
    const patch: Parameters<typeof setSiteSettings>[0] = {};
    if (body.publicRegistration !== undefined) {
      const parsed = parsePublicRegistration(body.publicRegistration);
      if (parsed == null) {
        return NextResponse.json({ error: "Invalid public registration value" }, { status: 400 });
      }
      patch.publicRegistration = parsed;
    }
    if (body.defaultAutosaveMs !== undefined) {
      const parsed = parseAutosaveMs(body.defaultAutosaveMs);
      if (parsed == null) {
        return NextResponse.json({ error: "Invalid autosave interval" }, { status: 400 });
      }
      patch.defaultAutosaveMs = parsed;
    }
    const settings = await setSiteSettings(patch);
    return NextResponse.json(settings);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}
