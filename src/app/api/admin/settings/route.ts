import { NextResponse } from "next/server";
import { z } from "zod";
import { parseAutosaveMs } from "@/lib/account-settings";
import { apiErrorResponse } from "@/lib/api-error";
import { requireSiteAdmin } from "@/lib/session";
import {
  parseRoomAnalysisAiEnabled,
  parseRoomAnalysisAiKeyInput,
  parseRoomAnalysisAiModel,
  parseRoomAnalysisAiProvider,
} from "@/lib/room-analysis-ai-settings";
import {
  getSiteSettings,
  parsePublicRegistration,
  parseReportWebsite,
  setSiteSettings,
} from "@/lib/site-settings";

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
  reportWebsite: z.string().optional(),
  roomAnalysisAiEnabled: z.union([z.boolean(), z.string()]).optional(),
  roomAnalysisAiProvider: z.string().optional(),
  roomAnalysisAiModel: z.string().optional(),
  roomAnalysisAiKey: z.string().optional(),
  clearRoomAnalysisAiKey: z.boolean().optional(),
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
        return NextResponse.json({ error: "Invalid save reminder interval" }, { status: 400 });
      }
      patch.defaultAutosaveMs = parsed;
    }
    if (body.reportWebsite !== undefined) {
      const parsed = parseReportWebsite(body.reportWebsite);
      if (parsed == null) {
        return NextResponse.json(
          { error: "Invalid report website. Use an http(s) URL or a host[:port]." },
          { status: 400 }
        );
      }
      patch.reportWebsite = parsed;
    }
    if (body.roomAnalysisAiEnabled !== undefined) {
      const parsed = parseRoomAnalysisAiEnabled(body.roomAnalysisAiEnabled);
      if (parsed == null) {
        return NextResponse.json({ error: "Invalid room-analysis AI enabled value" }, { status: 400 });
      }
      patch.roomAnalysisAiEnabled = parsed;
    }
    if (body.roomAnalysisAiProvider !== undefined) {
      const parsed = parseRoomAnalysisAiProvider(body.roomAnalysisAiProvider);
      if (parsed == null) {
        return NextResponse.json({ error: "Invalid room-analysis AI provider" }, { status: 400 });
      }
      patch.roomAnalysisAiProvider = parsed;
    }
    if (body.roomAnalysisAiModel !== undefined) {
      const parsed = parseRoomAnalysisAiModel(body.roomAnalysisAiModel);
      if (parsed == null) {
        return NextResponse.json({ error: "Invalid room-analysis AI model" }, { status: 400 });
      }
      patch.roomAnalysisAiModel = parsed || undefined;
      if (parsed === "") {
        return NextResponse.json({ error: "Invalid room-analysis AI model" }, { status: 400 });
      }
    }
    if (body.clearRoomAnalysisAiKey) {
      patch.clearRoomAnalysisAiKey = true;
    } else if (body.roomAnalysisAiKey !== undefined && body.roomAnalysisAiKey.trim() !== "") {
      const parsed = parseRoomAnalysisAiKeyInput(body.roomAnalysisAiKey);
      if (parsed == null || parsed === "") {
        return NextResponse.json({ error: "Invalid room-analysis AI key" }, { status: 400 });
      }
      patch.roomAnalysisAiKey = parsed;
    }
    const settings = await setSiteSettings(patch);
    return NextResponse.json(settings);
  } catch (e) {
    if (e instanceof Error && e.message.includes("AUTH_SECRET is required to save")) {
      return NextResponse.json(
        { error: "The server must have AUTH_SECRET set before an API key can be saved." },
        { status: 400 }
      );
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    return apiErrorResponse(e);
  }
}
