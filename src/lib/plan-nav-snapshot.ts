/** Viewport bitmap helpers for plan pan/zoom. Not applied to the live SVG. */

export const PLAN_SNAPSHOT_DPR_CAP = 2;

function roundPx(value: number): number {
  return Math.max(1, Math.round(value));
}

/** Size a viewport canvas to the CSS box at a capped device pixel ratio. */
export function sizePlanCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): { pixelW: number; pixelH: number; dpr: number } | null {
  if (!(cssWidth > 0) || !(cssHeight > 0)) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, PLAN_SNAPSHOT_DPR_CAP);
  const pixelW = roundPx(cssWidth * dpr);
  const pixelH = roundPx(cssHeight * dpr);
  if (canvas.width !== pixelW) canvas.width = pixelW;
  if (canvas.height !== pixelH) canvas.height = pixelH;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  return { pixelW, pixelH, dpr };
}

/** Copy an already-painted plan canvas into the gesture snapshot canvas. */
export function copyPlanCanvas(
  source: HTMLCanvasElement,
  dest: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): boolean {
  if (source.width < 1 || source.height < 1) return false;
  const sized = sizePlanCanvas(dest, cssWidth, cssHeight);
  if (!sized) return false;
  const ctx = dest.getContext("2d");
  if (!ctx) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, sized.pixelW, sized.pixelH);
  ctx.drawImage(source, 0, 0, sized.pixelW, sized.pixelH);
  return true;
}

/**
 * Composite a thin live SVG (fixtures, handles, drafts) over an already-painted
 * static plan canvas. The SVG must not contain the dense CAD tree.
 */
export async function compositeThinSvgOverCanvas(
  svg: SVGSVGElement,
  dest: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  base?: HTMLCanvasElement | null
): Promise<boolean> {
  const sized = sizePlanCanvas(dest, cssWidth, cssHeight);
  if (!sized) return false;
  const ctx = dest.getContext("2d");
  if (!ctx) return false;
  const { pixelW, pixelH } = sized;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelW, pixelH);
  if (base && base.width > 0 && base.height > 0) {
    ctx.drawImage(base, 0, 0, pixelW, pixelH);
  } else {
    ctx.fillStyle = "#0f1c24";
    ctx.fillRect(0, 0, pixelW, pixelH);
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(cssWidth));
  clone.setAttribute("height", String(cssHeight));
  clone.removeAttribute("style");
  clone.style.visibility = "visible";
  clone.querySelector("[data-plan-nav-layer]")?.removeAttribute("transform");
  for (const el of Array.from(clone.querySelectorAll("[data-plan-bg]"))) el.remove();

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("thin plan svg failed"));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, pixelW, pixelH);
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function snapshotViewKey(
  view: { zoom: number; panX: number; panY: number },
  cssWidth: number,
  cssHeight: number,
  viewW: number,
  viewH: number
): string {
  return [
    view.zoom.toFixed(6),
    view.panX.toFixed(4),
    view.panY.toFixed(4),
    cssWidth.toFixed(2),
    cssHeight.toFixed(2),
    viewW.toFixed(2),
    viewH.toFixed(2),
  ].join(":");
}

export function showPlanNavSnapshot(
  canvas: HTMLCanvasElement,
  svg: SVGSVGElement,
  staticCanvas?: HTMLCanvasElement | null
) {
  canvas.style.display = "block";
  canvas.style.willChange = "transform";
  // display:none takes the SVG out of rendering. visibility:hidden is not enough.
  svg.style.display = "none";
  svg.style.visibility = "hidden";
  if (staticCanvas) staticCanvas.style.display = "none";
}

export function hidePlanNavSnapshot(
  canvas: HTMLCanvasElement | null,
  svg: SVGSVGElement | null,
  staticCanvas?: HTMLCanvasElement | null
) {
  if (canvas) {
    canvas.style.transform = "";
    canvas.style.willChange = "";
    canvas.style.display = "none";
  }
  if (svg) {
    svg.style.display = "";
    svg.style.visibility = "";
  }
  if (staticCanvas) staticCanvas.style.display = "block";
}
