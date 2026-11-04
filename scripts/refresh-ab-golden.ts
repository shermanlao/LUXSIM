import { GOLDEN_LUXSIM_EXPECTED } from "../packages/project-io/src/ab-golden-room";
import { runGoldenRoomCalculation } from "../packages/project-io/src/ab-golden-room-calc";

const s = runGoldenRoomCalculation().summary;
const mf = 0.8;
console.log("Current solver summary:");
console.log(JSON.stringify(s, null, 2));
console.log("\nSuggested GOLDEN_LUXSIM_EXPECTED constants:");
console.log(
  JSON.stringify(
    {
      eave_lx: Number(s.eave.toFixed(2)),
      emin_lx: Number(s.emin.toFixed(2)),
      emax_lx: Number(s.emax.toFixed(2)),
      uo: Number(s.uo.toFixed(2)),
      ugr: Number((s.ugr ?? 0).toFixed(2)),
      maintained_eave_lx: Number((s.eave * mf).toFixed(2)),
      lpd_w_m2: Number((s.lpd ?? 0).toFixed(2)),
      total_watts: s.totalWatts,
      area_m2: s.areaM2,
    },
    null,
    2
  )
);
console.log("\nPublished reference:", GOLDEN_LUXSIM_EXPECTED);
