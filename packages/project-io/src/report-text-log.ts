import type { jsPDF } from "jspdf";

const PAGES = "__luxsimReportTextPages";

function collect(value: unknown, bag: string[]): void {
  if (typeof value === "string") {
    bag.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, bag);
  }
}

/** Record every string drawn with doc.text, per page, so tests can assert typography after a custom TTF is embedded. */
export function attachReportTextLog(doc: jsPDF): void {
  const pages: string[][] = [[]];
  (doc as unknown as Record<string, unknown>)[PAGES] = pages;
  const origText = doc.text.bind(doc);
  doc.text = ((text: unknown, ...rest: unknown[]) => {
    collect(text, pages[pages.length - 1]!);
    return (origText as (...args: unknown[]) => unknown)(text, ...rest);
  }) as typeof doc.text;
  const origAddPage = doc.addPage.bind(doc);
  doc.addPage = ((...args: unknown[]) => {
    pages.push([]);
    return (origAddPage as (...args: unknown[]) => unknown)(...args);
  }) as typeof doc.addPage;
}

export function reportPdfPlainText(doc: jsPDF): string {
  const pages = (doc as unknown as Record<string, unknown>)[PAGES];
  if (Array.isArray(pages)) return (pages as string[][]).flat().join("\n");
  return Buffer.from(doc.output("arraybuffer")).toString("latin1");
}

export function reportPdfPageText(doc: jsPDF, pageNum: number): string {
  const pages = (doc as unknown as Record<string, unknown>)[PAGES];
  if (Array.isArray(pages)) return ((pages as string[][])[pageNum - 1] ?? []).join("\n");
  return "";
}
