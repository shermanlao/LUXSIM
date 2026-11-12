import { describe, expect, it } from "vitest";
import { isLibraryCone, libraryConeLabel, luminaireListLabel } from "./luminaire-origin";

describe("library cone labels", () => {
  it("labels circular and linear generated photometry", () => {
    expect(
      libraryConeLabel({ origin: "library_cone", libraryFamily: "circular", libraryBeamDeg: 160 })
    ).toBe("Library cone · 160°");
    expect(
      libraryConeLabel({ origin: "library_cone", libraryFamily: "linear", libraryBeamDeg: 120 })
    ).toBe("Library cone · Linear 120°");
    expect(libraryConeLabel({ origin: "upload", libraryBeamDeg: 40 })).toBeNull();
    expect(isLibraryCone({ origin: "upload" })).toBe(false);
    expect(
      luminaireListLabel("Office downlight", {
        origin: "library_cone",
        libraryFamily: "circular",
        libraryBeamDeg: 36,
      })
    ).toBe("Office downlight (Library cone · 36°)");
  });
});
