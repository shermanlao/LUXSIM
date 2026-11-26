import { describe, expect, it } from "vitest";
import {
  GOLDEN_LUXSIM_EXPECTED,
  GOLDEN_ROOM,
} from "./ab-golden-room";
import { runGoldenRoomCalculation } from "./ab-golden-room-calc";

describe("AB golden room", () => {
  it("matches published LUXSIM Em / Uo / UGR reference", () => {
    const results = runGoldenRoomCalculation();
    const s = results.summary;
    expect(s.eave).toBeCloseTo(GOLDEN_LUXSIM_EXPECTED.eave_lx, 0);
    expect(s.emin).toBeCloseTo(GOLDEN_LUXSIM_EXPECTED.emin_lx, 0);
    expect(s.uo).toBeCloseTo(GOLDEN_LUXSIM_EXPECTED.uo, 2);
    expect(s.ugr).toBeCloseTo(GOLDEN_LUXSIM_EXPECTED.ugr, 1);
    expect(s.eave * GOLDEN_ROOM.calc.maintenanceFactor!).toBeCloseTo(
      GOLDEN_LUXSIM_EXPECTED.maintained_eave_lx,
      0
    );
  });
});
