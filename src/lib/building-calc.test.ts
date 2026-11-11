import { describe, expect, it } from "vitest";
import { formatCalcCompletionMessage } from "./building-calc";

describe("formatCalcCompletionMessage", () => {
  it("returns null when no rooms calculated", () => {
    expect(formatCalcCompletionMessage({ roomsCalculated: 0, instanceCount: 0 })).toBeNull();
  });

  it("explains zero lux when no luminaires are placed", () => {
    expect(formatCalcCompletionMessage({ roomsCalculated: 9, instanceCount: 0 })).toMatch(
      /0 lx/
    );
    expect(formatCalcCompletionMessage({ roomsCalculated: 9, instanceCount: 0 })).not.toMatch(
      /client-side\)$/
    );
  });

  it("uses standard message when fixtures exist", () => {
    expect(formatCalcCompletionMessage({ roomsCalculated: 3, instanceCount: 5 })).toBe(
      "Calculation complete (client-side)"
    );
  });
});
