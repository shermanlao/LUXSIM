import { describe, expect, it } from "vitest";
import { qrMatrixForUrl } from "./qr-code";

describe("qrMatrixForUrl", () => {
  it("returns a square module matrix for a project share URL", () => {
    const m = qrMatrixForUrl("https://example.test/view/abc");
    expect(m.length).toBeGreaterThan(16);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(m.some((row) => row.some((on) => on))).toBe(true);
    expect(m.some((row) => row.some((on) => !on))).toBe(true);
  });
});
