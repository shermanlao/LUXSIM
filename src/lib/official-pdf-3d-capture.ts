/**
 * Official Full PDF report 3D-capture decision used by BuildingEditor.exportFullPdf().
 * When WebGL capture is unavailable, or a capture attempt throws, 3D stills are
 * omitted and the status bar is told — other chapters still export. Successful
 * captures must not raise a false omission warning. No headless 3D images are invented.
 */

export const REPORT_3D_OMITTED_STATUS =
  "3D views could not be captured; the rest of the report was exported.";

export type OfficialReport3dRender = {
  projectGreyscale: string;
  projectFalseColor: string;
  roomGreyscale: Record<string, string>;
  roomFalseColor: Record<string, string>;
};

export type OfficialFullPdf3dViews = {
  projectPerspectiveGreyscale?: string;
  projectPerspectiveFalseColor?: string;
  persp3dGreyscale?: Record<string, string>;
  persp3dFalseColor?: Record<string, string>;
};

export type OfficialPdf3dCaptureReason = "included" | "unavailable" | "capture-failed";

export type OfficialPdf3dCaptureResult = {
  views: OfficialFullPdf3dViews;
  /** Status-bar warning when 3D stills were omitted. Null when stills were included. */
  status: string | null;
  omitted: boolean;
  reason: OfficialPdf3dCaptureReason;
};

function mapViews(rendered: OfficialReport3dRender): OfficialFullPdf3dViews {
  return {
    projectPerspectiveGreyscale: rendered.projectGreyscale,
    projectPerspectiveFalseColor: rendered.projectFalseColor,
    persp3dGreyscale: rendered.roomGreyscale,
    persp3dFalseColor: rendered.roomFalseColor,
  };
}

export function hasOfficialProject3dStills(views: OfficialFullPdf3dViews): boolean {
  return Boolean(views.projectPerspectiveGreyscale || views.projectPerspectiveFalseColor);
}

function omitted(reason: Exclude<OfficialPdf3dCaptureReason, "included">): OfficialPdf3dCaptureResult {
  return {
    views: {},
    status: REPORT_3D_OMITTED_STATUS,
    omitted: true,
    reason,
  };
}

/**
 * Capture 3D stills for the official Full PDF path, or explain why they were omitted.
 * `render` is only called when `captureAvailable()` is true, so a headless
 * environment must not invent images.
 */
export function captureOfficialReport3dViews(opts: {
  captureAvailable: () => boolean;
  render: () => OfficialReport3dRender;
}): OfficialPdf3dCaptureResult {
  try {
    if (!opts.captureAvailable()) {
      return omitted("unavailable");
    }
    const views = mapViews(opts.render());
    if (!hasOfficialProject3dStills(views)) {
      return omitted("capture-failed");
    }
    return {
      views,
      status: null,
      omitted: false,
      reason: "included",
    };
  } catch (err) {
    console.warn("3D report capture failed", err);
    return omitted("capture-failed");
  }
}
