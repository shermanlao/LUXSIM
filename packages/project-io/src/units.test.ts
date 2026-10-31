import { describe, expect, it } from "vitest";
import { mmToM, mToMm, parseLengthToM } from "./units";

describe("units", () => {
  it("converts mm and m", () => {
    expect(mmToM(15000)).toBe(15);
    expect(mToMm(15)).toBe(15000);
  });

  it("treats a bare number as millimetres", () => {
    expect(parseLengthToM("15000")).toBe(15);
    expect(parseLengthToM("15")).toBe(0.015);
    expect(parseLengthToM(" 6000 ")).toBe(6);
  });

  it("accepts m / cm / mm suffixes", () => {
    expect(parseLengthToM("15m")).toBe(15);
    expect(parseLengthToM("15M")).toBe(15);
    expect(parseLengthToM("15000mm")).toBe(15);
    expect(parseLengthToM("1500cm")).toBe(15);
    expect(parseLengthToM("15 cm")).toBe(0.15);
  });

  it("rejects invalid input", () => {
    expect(parseLengthToM("")).toBeNull();
    expect(parseLengthToM("abc")).toBeNull();
    expect(parseLengthToM("-10")).toBeNull();
  });
});
