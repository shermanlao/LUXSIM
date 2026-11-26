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
  /** Project-wide 3D isolines still. Omitted when no overlay exists or capture fails. */
  projectIsolines?: string;
  roomGreyscale: Record<string, string>;
  roomFalseColor: Record<string, string>;
  /** Per-room 3D isolines stills, keyed by roomId. Rooms without a still are omitted. */
  roomIsolines?: Record<string, string>;
};

export type OfficialFullPdf3dViews = {
  projectPerspectiveGreyscale?: string;
  projectPerspectiveFalseColor?: string;
  projectPerspectiveIsolines?: string;
  persp3dGreyscale?: Record<string, string>;
  persp3dFalseColor?: Record<string, string>;
  persp3dIsolines?: Record<string, string>;
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
  const views: OfficialFullPdf3dViews = {
    projectPerspectiveGreyscale: rendered.projectGreyscale,
    projectPerspectiveFalseColor: rendered.projectFalseColor,
    persp3dGreyscale: rendered.roomGreyscale,
    persp3dFalseColor: rendered.roomFalseColor,
  };
  if (rendered.projectIsolines) {
    views.projectPerspectiveIsolines = rendered.projectIsolines;
  }
  if (rendered.roomIsolines && Object.keys(rendered.roomIsolines).length > 0) {
    views.persp3dIsolines = rendered.roomIsolines;
  }
  return views;
}

export function hasOfficialProject3dStills(views: OfficialFullPdf3dViews): boolean {
  return Boolean(views.projectPerspectiveGreyscale || views.projectPerspectiveFalseColor);
}

export function hasOfficialProject3dIsolines(views: OfficialFullPdf3dViews): boolean {
  return Boolean(views.projectPerspectiveIsolines);
}

/**
 * Capture one official 3D isoline still. Returns undefined when there is no
 * overlay or the attempt throws — never invents an image. A failed isoline
 * still must not drop already-captured greyscale / false-colour chapters.
 */
export function tryOfficialReport3dIsolineStill(
  render: () => string | null | undefined
): string | undefined {
  try {
    return render() ?? undefined;
  } catch (err) {
    console.warn("3D isoline report capture failed", err);
    return undefined;
  }
}

/** Assign a per-room official 3D isoline still when capture succeeds. */
export function assignOfficialReport3dIsolineStill(
  bucket: Record<string, string>,
  roomId: string,
  render: () => string | null | undefined
): void {
  const still = tryOfficialReport3dIsolineStill(render);
  if (still) bucket[roomId] = still;
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

/** Same official 3D-capture decision, allowing an async render that can yield between views. */
export async function captureOfficialReport3dViewsAsync(opts: {
  captureAvailable: () => boolean;
  render: () => OfficialReport3dRender | Promise<OfficialReport3dRender>;
}): Promise<OfficialPdf3dCaptureResult> {
  try {
    if (!opts.captureAvailable()) {
      return omitted("unavailable");
    }
    const views = mapViews(await opts.render());
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
