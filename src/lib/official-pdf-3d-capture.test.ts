import { describe, expect, it, vi } from "vitest";
import { buildFullReportPdf, rectPolygon, reportPdfPlainText } from "@luxsim/project-io";
import type { ProjectSceneV2, ResultsV2, RoomV2 } from "@luxsim/project-io";
import {
  assignOfficialReport3dIsolineStill,
  captureOfficialReport3dViews,
  hasOfficialProject3dIsolines,
  hasOfficialProject3dStills,
  REPORT_3D_OMITTED_STATUS,
  tryOfficialReport3dIsolineStill,
} from "./official-pdf-3d-capture";
import { webglCaptureAvailable } from "./render-scene-3d";

const TINY_JPEG =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAgADADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2OiiigAooooAKKKKACiiigAooooAKKKKAP//Z";

function officeScene(): { scene: ProjectSceneV2; results: ResultsV2 } {
  const room: RoomV2 = {
    id: "r1",
    storeyId: "s1",
    name: "Office",
    polygon: rectPolygon(0, 0, 6, 5),
    heightM: 2.8,
    workplaneHeightM: 0.75,
    reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
    calc: { gridSpacing: 0.5, interreflection: true, bounces: 2, computeUgr: true },
  };
  const scene: ProjectSceneV2 = {
    version: 2,
    storeys: [{ id: "s1", name: "L9M", elevationM: 0, heightM: 3 }],
    rooms: [room],
    underlays: [],
    fixtureLibraryIds: [],
    instances: [],
    ui: { activeStoreyId: "s1", activeRoomId: "r1", viewMode: "top", tool: "select" },
  };
  const results: ResultsV2 = {
    version: 2,
    byRoomId: {
      r1: {
        version: 1,
        summary: {
          eave: 400,
          emin: 300,
          emax: 500,
          uo: 0.75,
          ugr: 16,
          lpd: 2,
          totalWatts: 30,
          areaM2: 30,
        },
        grid: {
          originX: 0,
          originY: 0,
          spacing: 0.5,
          nx: 2,
          ny: 2,
          z: 0.75,
          lux: [300, 400, 400, 500],
        },
        meta: { interreflection: true, bounces: 2, calculatedAt: "2026-11-14T08:00:00.000Z", disclaimer: "assist" },
      },
    },
  };
  return { scene, results };
}

function pdfText(doc: ReturnType<typeof buildFullReportPdf>): string {
  return reportPdfPlainText(doc);
}

function officialPdfFromCapture(
  captured: ReturnType<typeof captureOfficialReport3dViews>
): ReturnType<typeof buildFullReportPdf> {
  const { scene, results } = officeScene();
  return buildFullReportPdf({
    projectName: "AED-180297 L9M",
    scene,
    results,
    photometry: {},
    wattsById: {},
    luxsimVersion: "0.1.0",
    ...captured.views,
  });
}

const STILLS = {
  projectGreyscale: TINY_JPEG,
  projectFalseColor: TINY_JPEG,
  roomGreyscale: { r1: TINY_JPEG },
  roomFalseColor: { r1: TINY_JPEG },
};

describe("captureOfficialReport3dViews", () => {
  it("warns on the official status path and does not invent stills when WebGL capture is unavailable", () => {
    const render = vi.fn(() => {
      throw new Error("must not invent headless 3D images");
    });
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => false,
      render,
    });
    expect(render).not.toHaveBeenCalled();
    expect(captured.omitted).toBe(true);
    expect(captured.reason).toBe("unavailable");
    expect(captured.status).toBe(REPORT_3D_OMITTED_STATUS);
    expect(captured.status).toMatch(/3D views/i);
    expect(hasOfficialProject3dStills(captured.views)).toBe(false);
    expect(captured.views).toEqual({});
  });

  it("does not report an omission when 3D stills were captured and included", () => {
    const render = vi.fn(() => STILLS);
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render,
    });
    expect(render).toHaveBeenCalledTimes(1);
    expect(captured.omitted).toBe(false);
    expect(captured.reason).toBe("included");
    expect(captured.status).toBeNull();
    expect(hasOfficialProject3dStills(captured.views)).toBe(true);
    expect(captured.views.projectPerspectiveGreyscale).toBe(TINY_JPEG);
    expect(captured.views.projectPerspectiveFalseColor).toBe(TINY_JPEG);
    expect(captured.views.persp3dGreyscale).toEqual({ r1: TINY_JPEG });
    expect(captured.views.persp3dFalseColor).toEqual({ r1: TINY_JPEG });
    expect(hasOfficialProject3dIsolines(captured.views)).toBe(false);
    expect(captured.views.projectPerspectiveIsolines).toBeUndefined();
  });

  it("maps official 3D isoline stills without overloading false-colour slots", () => {
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render: () => ({
        ...STILLS,
        projectIsolines: "data:image/jpeg,iso-project",
        roomIsolines: { r1: "data:image/jpeg,iso-room" },
      }),
    });
    expect(captured.omitted).toBe(false);
    expect(captured.status).toBeNull();
    expect(captured.views.projectPerspectiveIsolines).toBe("data:image/jpeg,iso-project");
    expect(captured.views.persp3dIsolines).toEqual({ r1: "data:image/jpeg,iso-room" });
    expect(captured.views.projectPerspectiveFalseColor).toBe(TINY_JPEG);
    expect(captured.views.persp3dFalseColor).toEqual({ r1: TINY_JPEG });
    expect(hasOfficialProject3dIsolines(captured.views)).toBe(true);
  });

  it("still warns and omits 3D when a capture attempt throws", () => {
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render: () => {
        throw new Error("WebGL context lost");
      },
    });
    expect(captured.omitted).toBe(true);
    expect(captured.reason).toBe("capture-failed");
    expect(captured.status).toBe(REPORT_3D_OMITTED_STATUS);
    expect(hasOfficialProject3dStills(captured.views)).toBe(false);
  });

  it("uses the official availability check in this environment without inventing images", () => {
    expect(webglCaptureAvailable()).toBe(false);
    const render = vi.fn(() => STILLS);
    const captured = captureOfficialReport3dViews({
      captureAvailable: webglCaptureAvailable,
      render,
    });
    expect(render).not.toHaveBeenCalled();
    expect(captured.reason).toBe("unavailable");
    expect(captured.status).toBe(REPORT_3D_OMITTED_STATUS);
  });
});

describe("official Full PDF report with 3D capture decision", () => {
  it("exports the remaining chapters and hides the empty 3D views contents entry when capture is unavailable", () => {
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => false,
      render: () => {
        throw new Error("must not invent headless 3D images");
      },
    });
    expect(captured.status).toBe(REPORT_3D_OMITTED_STATUS);
    const text = pdfText(officialPdfFromCapture(captured));
    expect(text).not.toContain("3D views");
    expect(text).not.toContain("3D Isolines");
    expect(text).toContain("5. Lighting Plan");
    expect(text).toContain("6. Per-room summary and working plane");
    expect(text).toContain("7. Product sheets");
    expect(text).toContain("8. Luminaire schedule");
    expect(text).toContain("Lighting Plan");
  });

  it("includes the 3D views chapter and does not warn when stills were captured", () => {
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render: () => STILLS,
    });
    expect(captured.status).toBeNull();
    const text = pdfText(officialPdfFromCapture(captured));
    expect(text).toContain("6. 3D views");
    expect(text).toContain("3D greyscale");
    expect(text).toContain("3D false colour");
    expect(text).not.toContain("3D Isolines");
    expect(text).toContain("7. Per-room summary and working plane");
  });

  it("adds a 3D Isolines chapter after 3D views and keeps 2D isolux plus greyscale / false-colour", () => {
    const { scene, results } = officeScene();
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render: () => ({
        ...STILLS,
        projectIsolines: TINY_JPEG,
        roomIsolines: { r1: TINY_JPEG },
      }),
    });
    expect(captured.status).toBeNull();
    const text = pdfText(
      buildFullReportPdf({
        projectName: "AED-180297 L9M",
        scene,
        results,
        photometry: {},
        wattsById: {},
        luxsimVersion: "0.1.0",
        isoluxSnapshots: { r1: TINY_JPEG },
        ...captured.views,
      })
    );
    expect(text).toContain("6. 3D views");
    expect(text).toContain("7. 3D Isolines");
    expect(text).toContain("8. Per-room summary and working plane");
    expect(text).toContain("3D greyscale");
    expect(text).toContain("3D false colour");
    expect(text).toContain("3D isolines");
    expect(text).toContain("Working plane — isolux diagram");
  });

  it("still hides the empty 3D views contents entry after a failed capture, and exports other chapters", () => {
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render: () => {
        throw new Error("WebGL context lost");
      },
    });
    expect(captured.status).toBe(REPORT_3D_OMITTED_STATUS);
    const text = pdfText(officialPdfFromCapture(captured));
    expect(text).not.toContain("3D views");
    expect(text).not.toContain("3D Isolines");
    expect(text).toContain("5. Lighting Plan");
    expect(text).toContain("6. Per-room summary and working plane");
  });
});

describe("official 3D isoline still capture helpers", () => {
  it("does not invent a still when isoline capture throws or returns nothing", () => {
    expect(tryOfficialReport3dIsolineStill(() => null)).toBeUndefined();
    expect(
      tryOfficialReport3dIsolineStill(() => {
        throw new Error("room isoline capture failed");
      })
    ).toBeUndefined();
    const bucket: Record<string, string> = { keep: TINY_JPEG };
    assignOfficialReport3dIsolineStill(bucket, "r2", () => {
      throw new Error("room isoline capture failed");
    });
    expect(bucket).toEqual({ keep: TINY_JPEG });
    expect(bucket.r2).toBeUndefined();
  });

  it("records a successful isoline still without raising an omission", () => {
    const captured = captureOfficialReport3dViews({
      captureAvailable: () => true,
      render: () => ({
        ...STILLS,
        projectIsolines: tryOfficialReport3dIsolineStill(() => TINY_JPEG),
        roomIsolines: (() => {
          const bucket: Record<string, string> = {};
          assignOfficialReport3dIsolineStill(bucket, "r1", () => TINY_JPEG);
          assignOfficialReport3dIsolineStill(bucket, "r-missing", () => {
            throw new Error("isoline capture failed");
          });
          return bucket;
        })(),
      }),
    });
    expect(captured.omitted).toBe(false);
    expect(captured.status).toBeNull();
    expect(captured.views.projectPerspectiveGreyscale).toBe(TINY_JPEG);
    expect(captured.views.projectPerspectiveFalseColor).toBe(TINY_JPEG);
    expect(captured.views.projectPerspectiveIsolines).toBe(TINY_JPEG);
    expect(captured.views.persp3dIsolines).toEqual({ r1: TINY_JPEG });
  });
});
