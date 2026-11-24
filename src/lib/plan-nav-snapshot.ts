/** Viewport bitmap capture for live plan pan/zoom. Not applied to the live SVG. */

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

function stripRasterImages(root: SVGSVGElement) {
  for (const el of Array.from(root.querySelectorAll("image"))) el.remove();
}

function stripPlanBackground(root: SVGSVGElement) {
  for (const el of Array.from(root.querySelectorAll("[data-plan-bg]"))) el.remove();
}

function navLayer(root: SVGSVGElement): Element | null {
  return root.querySelector("[data-plan-nav-layer]");
}

function overlayNode(root: SVGSVGElement): Element | null {
  return root.querySelector("[data-plan-isolux-overlay]");
}

/** Keep CAD / rooms under the false-colour overlay; drop the overlay and what follows. */
function stripFromOverlayOnward(root: SVGSVGElement) {
  const overlay = overlayNode(root);
  if (!overlay) return;
  let node: ChildNode | null = overlay;
  while (node) {
    const next: ChildNode | null = node.nextSibling;
    node.parentNode?.removeChild(node);
    node = next;
  }
}

/** Keep the overlay vectors (isolines / labels) and fixtures / outlines above it. */
function keepFromOverlayOnward(root: SVGSVGElement) {
  const overlay = overlayNode(root);
  if (!overlay) {
    navLayer(root)?.replaceChildren();
    return;
  }
  let node: ChildNode | null = overlay.previousSibling;
  while (node) {
    const prev: ChildNode | null = node.previousSibling;
    node.parentNode?.removeChild(node);
    node = prev;
  }
}

function prepareSvgClone(svg: SVGSVGElement, cssWidth: number, cssHeight: number): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(cssWidth));
  clone.setAttribute("height", String(cssHeight));
  clone.removeAttribute("style");
  clone.style.visibility = "visible";
  const nav = navLayer(clone);
  nav?.removeAttribute("transform");
  return clone;
}

function drawLiveSvgImage(
  ctx: CanvasRenderingContext2D,
  el: SVGImageElement,
  svg: SVGSVGElement,
  pixelW: number,
  pixelH: number
) {
  const svgRect = svg.getBoundingClientRect();
  if (!(svgRect.width > 0) || !(svgRect.height > 0)) return;
  const ctm = el.getScreenCTM();
  if (!ctm) return;
  const w = el.width.baseVal.value;
  const h = el.height.baseVal.value;
  if (!(w > 0) || !(h > 0)) return;
  const point = svg.createSVGPoint();
  const map = (lx: number, ly: number) => {
    point.x = lx;
    point.y = ly;
    const screen = point.matrixTransform(ctm);
    return {
      x: ((screen.x - svgRect.left) / svgRect.width) * pixelW,
      y: ((screen.y - svgRect.top) / svgRect.height) * pixelH,
    };
  };
  const origin = map(0, 0);
  const axisX = map(w, 0);
  const axisY = map(0, h);
  const opacity = Number(el.getAttribute("opacity") ?? "1");
  ctx.save();
  ctx.setTransform(
    (axisX.x - origin.x) / w,
    (axisX.y - origin.y) / w,
    (axisY.x - origin.x) / h,
    (axisY.y - origin.y) / h,
    origin.x,
    origin.y
  );
  if (Number.isFinite(opacity)) ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
  try {
    ctx.drawImage(el, 0, 0, w, h);
  } catch {
    /* tainted or not yet decodable */
  }
  ctx.restore();
}

async function rasterizeVectorSvg(
  source: SVGSVGElement,
  ctx: CanvasRenderingContext2D,
  pixelW: number,
  pixelH: number
): Promise<boolean> {
  const xml = new XMLSerializer().serializeToString(source);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("plan snapshot vector image failed"));
      img.src = url;
    });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(img, 0, 0, pixelW, pixelH);
    ctx.restore();
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Paint the currently visible SVG viewport into a canvas of the same CSS size.
 * Raster images (plan underlay and false-colour workplanes) are drawn from the
 * live elements so the serialized SVG does not contain huge PNG data URLs.
 * The bitmap is viewport-sized (not the whole world), at a capped device pixel ratio.
 */
export async function captureSvgViewportToCanvas(
  svg: SVGSVGElement,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  opts?: { baseCanvas?: HTMLCanvasElement | null }
): Promise<boolean> {
  const sized = sizePlanCanvas(canvas, cssWidth, cssHeight);
  if (!sized) return false;
  const { pixelW, pixelH } = sized;

  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pixelW, pixelH);

  const base = opts?.baseCanvas;
  const usedBase = Boolean(base && base.width > 0 && base.height > 0);
  if (usedBase && base) {
    ctx.drawImage(base, 0, 0, pixelW, pixelH);
  } else {
    const bg = svg.querySelector("[data-plan-bg]");
    const fill = bg?.getAttribute("fill");
    ctx.fillStyle = fill && fill !== "none" && fill !== "transparent" ? fill : "#0f1c24";
    ctx.fillRect(0, 0, pixelW, pixelH);
  }

  const images = Array.from(svg.querySelectorAll("image")) as SVGImageElement[];
  const underlay = images.filter((el) => !el.hasAttribute("data-plan-falsecolor-image"));
  const falseColor = images.filter((el) => el.hasAttribute("data-plan-falsecolor-image"));
  const hasOverlay = Boolean(overlayNode(svg));

  if (!usedBase) {
    for (const el of underlay) drawLiveSvgImage(ctx, el, svg, pixelW, pixelH);
  }

  const below = prepareSvgClone(svg, cssWidth, cssHeight);
  stripRasterImages(below);
  stripPlanBackground(below);
  if (hasOverlay) stripFromOverlayOnward(below);
  const belowOk = await rasterizeVectorSvg(below, ctx, pixelW, pixelH);
  if (!belowOk) return false;

  for (const el of falseColor) drawLiveSvgImage(ctx, el, svg, pixelW, pixelH);

  if (hasOverlay) {
    const above = prepareSvgClone(svg, cssWidth, cssHeight);
    stripRasterImages(above);
    stripPlanBackground(above);
    keepFromOverlayOnward(above);
    const aboveOk = await rasterizeVectorSvg(above, ctx, pixelW, pixelH);
    if (!aboveOk) return false;
  }

  return true;
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
  // display:none takes the dense (or leftover) SVG out of rendering.
  // visibility:hidden alone still leaves the tree in the layer.
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
