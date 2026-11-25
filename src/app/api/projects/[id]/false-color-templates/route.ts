import { NextResponse } from "next/server";
import type { FalseColorScale, IsoluxPalette } from "@luxsim/project-io";
import { apiErrorResponse } from "@/lib/api-error";
import {
  FALSE_COLOR_TEMPLATE_COPY,
  parseFalseColorScaleTemplates,
  saveFalseColorScaleTemplate,
} from "@/lib/false-color-scale-templates";
import { getOrgSettings, setOrgSettings } from "@/lib/org-settings";
import { requireProjectAccess } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

function templatesJson(templates: ReturnType<typeof parseFalseColorScaleTemplates>) {
  return { templates };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { orgId } = await requireProjectAccess(id);
    const settings = await getOrgSettings(orgId);
    return NextResponse.json(templatesJson(settings.falseColorScaleTemplates));
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const access = await requireProjectAccess(id);
    if (!access.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const palette = body?.palette === "greyscale" ? "greyscale" : ("falsecolor" as IsoluxPalette);
    const scale = body?.scale;
    if (!scale || typeof scale !== "object" || Array.isArray(scale)) {
      return NextResponse.json({ error: "Invalid scale" }, { status: 400 });
    }
    const settings = await getOrgSettings(access.orgId);
    const result = saveFalseColorScaleTemplate(
      settings.falseColorScaleTemplates,
      body?.name,
      scale as FalseColorScale,
      palette
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const next = await setOrgSettings(access.orgId, {
      ...settings,
      falseColorScaleTemplates: result.templates,
    });
    return NextResponse.json({
      ...templatesJson(next.falseColorScaleTemplates),
      template: result.template,
      overwritten: result.overwritten,
    });
  } catch (e) {
    return apiErrorResponse(e, FALSE_COLOR_TEMPLATE_COPY.saveFailed);
  }
}
