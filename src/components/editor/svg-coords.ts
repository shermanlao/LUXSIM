/** Map browser client coords → SVG viewBox coords (respects preserveAspectRatio letterboxing). */
export function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}
