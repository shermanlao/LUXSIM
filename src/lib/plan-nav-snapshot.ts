/** Viewport bitmap capture for live plan pan/zoom. Not applied to the live SVG. */

const SNAPSHOT_DPR_CAP = 2;

function roundPx(value: number): number {
  return Math.max(1, Math.round(value));
}

async function hrefToDataUrl(href: string): Promise<string | null> {
  if (!href) return null;
  if (href.startsWith("data:")) return href;
  try {
    const res = await fetch(href);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Inline raster hrefs so a serialized SVG can be painted onto a canvas. */
export async function inlineSvgImageHrefs(root: SVGSVGElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("image"));
  await Promise.all(
    images.map(async (el) => {
      const href = el.getAttribute("href") || el.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
      if (!href || href.startsWith("data:")) return;
      const dataUrl = await hrefToDataUrl(href);
      if (!dataUrl) return;
      el.setAttribute("href", dataUrl);
      el.removeAttribute("xlink:href");
      el.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
    })
  );
}

function prepareSvgClone(svg: SVGSVGElement, cssWidth: number, cssHeight: number): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(cssWidth));
  clone.setAttribute("height", String(cssHeight));
  clone.removeAttribute("style");
  clone.style.visibility = "visible";
  const nav = clone.querySelector("[data-plan-nav-layer]");
  nav?.removeAttribute("transform");
  return clone;
}

/**
 * Paint the currently visible SVG viewport into a canvas of the same CSS size.
 * The bitmap is viewport-sized (not the whole world), at a capped device pixel ratio.
 * Returns false if the canvas could not be painted.
 */
export async function captureSvgViewportToCanvas(
  svg: SVGSVGElement,
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number
): Promise<boolean> {
  if (!(cssWidth > 0) || !(cssHeight > 0)) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, SNAPSHOT_DPR_CAP);
  const pixelW = roundPx(cssWidth * dpr);
  const pixelH = roundPx(cssHeight * dpr);
  if (canvas.width !== pixelW) canvas.width = pixelW;
  if (canvas.height !== pixelH) canvas.height = pixelH;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const clone = prepareSvgClone(svg, cssWidth, cssHeight);
  try {
    await inlineSvgImageHrefs(clone);
  } catch {
    /* keep whatever hrefs could be inlined */
  }

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("plan snapshot image failed"));
      img.src = url;
    });
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixelW, pixelH);
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

export function showPlanNavSnapshot(canvas: HTMLCanvasElement, svg: SVGSVGElement) {
  canvas.style.display = "block";
  canvas.style.willChange = "transform";
  svg.style.visibility = "hidden";
}

export function hidePlanNavSnapshot(canvas: HTMLCanvasElement | null, svg: SVGSVGElement | null) {
  if (canvas) {
    canvas.style.transform = "";
    canvas.style.willChange = "";
    canvas.style.display = "none";
  }
  if (svg) svg.style.visibility = "";
}
