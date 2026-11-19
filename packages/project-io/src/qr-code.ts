import type { jsPDF } from "jspdf";
import { encode } from "./vendor/uqr.mjs";

/** Module matrix for a view-only project URL (with quiet zone). */
export function qrMatrixForUrl(url: string): boolean[][] {
  const result = encode(url, { ecc: "M", border: 2 });
  return result.data;
}

/** Draw a QR code in millimetres at (x, y), size is the outer square including quiet zone. */
export function drawQrCode(doc: jsPDF, url: string, x: number, y: number, sizeMm: number) {
  const matrix = qrMatrixForUrl(url);
  const n = matrix.length;
  if (n < 1 || sizeMm <= 0) return;
  const module = sizeMm / n;
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, sizeMm, sizeMm, "F");
  doc.setFillColor(18, 32, 42);
  for (let j = 0; j < n; j += 1) {
    const row = matrix[j]!;
    for (let i = 0; i < n; i += 1) {
      if (!row[i]) continue;
      doc.rect(x + i * module, y + j * module, module, module, "F");
    }
  }
}
