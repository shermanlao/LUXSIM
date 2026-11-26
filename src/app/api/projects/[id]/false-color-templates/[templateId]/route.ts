import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { FALSE_COLOR_TEMPLATE_COPY, deleteFalseColorScaleTemplate } from "@/lib/false-color-scale-templates";
import { getOrgSettings, setOrgSettings } from "@/lib/org-settings";
import { requireProjectAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string; templateId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id: _projectId, templateId } = await params;
    const access = await requireProjectAccess(_projectId);
    if (!access.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const settings = await getOrgSettings(access.orgId);
    const result = deleteFalseColorScaleTemplate(settings.falseColorScaleTemplates, templateId);
    if (!result.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const lastUsed = settings.lastUsedFalseColorScale;
    const nextLastUsed =
      lastUsed && lastUsed.templateId === templateId ? { ...lastUsed, templateId: null } : lastUsed;
    const next = await setOrgSettings(access.orgId, {
      ...settings,
      falseColorScaleTemplates: result.templates,
      lastUsedFalseColorScale: nextLastUsed,
    });
    return NextResponse.json({ templates: next.falseColorScaleTemplates });
  } catch (e) {
    return apiErrorResponse(e, FALSE_COLOR_TEMPLATE_COPY.deleteFailed);
  }
}
