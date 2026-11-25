import { NextResponse } from "next/server";
import type { FalseColorScale, IsoluxPalette } from "@luxsim/project-io";
import { parseStoredFalseColorScale, parseStoredFalseColorScaleTemplateId } from "@luxsim/project-io";
import { apiErrorResponse } from "@/lib/api-error";
import { lastUsedFromScale } from "@/lib/false-color-scale-memory";
import { getOrgSettings, mergeProjectFalseColorScaleMemory, setOrgSettings } from "@/lib/org-settings";
import { requireProjectAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

/** Persist the applied (or saved-as-template) scale on the project and as workspace last-used. */
export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const access = await requireProjectAccess(id);
    if (!access.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const scale = parseStoredFalseColorScale(body?.scale) ?? parseStoredFalseColorScale(body);
    if (!scale) {
      return NextResponse.json({ error: "Invalid scale" }, { status: 400 });
    }
    const palette: IsoluxPalette = body?.palette === "greyscale" ? "greyscale" : "falsecolor";
    const templateId = parseStoredFalseColorScaleTemplateId(body?.templateId);
    const lastUsed = lastUsedFromScale(scale as FalseColorScale, templateId, palette);
    const settings = await getOrgSettings(access.orgId);
    await setOrgSettings(access.orgId, {
      ...settings,
      lastUsedFalseColorScale: lastUsed,
    });
    await mergeProjectFalseColorScaleMemory(id, lastUsed);
    return NextResponse.json({ ok: true, lastUsed });
  } catch (e) {
    return apiErrorResponse(e, "Could not remember the false-colour scale. / 無法記住偽色比例尺。");
  }
}
