import { afterEach, describe, expect, it, vi } from "vitest";
import { prefixedId, randomId } from "./random-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("randomId", () => {
  it("uses crypto.randomUUID when it exists", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    });
    expect(randomId()).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("falls back to getRandomValues when randomUUID is missing (HTTP pages)", () => {
    const bytes = new Uint8Array(16).fill(0);
    vi.stubGlobal("crypto", {
      getRandomValues: (target: Uint8Array) => {
        target.set(bytes);
        return target;
      },
    });
    const id = randomId();
    expect(id).toMatch(UUID_RE);
    expect(id.startsWith("00000000-0000-4000-8000-")).toBe(true);
  });

  it("throws if neither randomUUID nor getRandomValues is available", () => {
    vi.stubGlobal("crypto", {});
    expect(() => randomId()).toThrow(/random bytes is not available/);
  });
});

describe("prefixedId", () => {
  it("prefixes a short id", () => {
    vi.stubGlobal("crypto", {
      randomUUID: () => "abcdef01-2345-4678-89ab-cdef01234567",
    });
    expect(prefixedId("inst")).toBe("inst_abcdef01");
  });
});
