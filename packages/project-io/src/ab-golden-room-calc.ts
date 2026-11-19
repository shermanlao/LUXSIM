import { readFileSync } from "fs";
import path from "path";
import { parseIes } from "../../photometry/src/index";
import { calculate } from "../../solver/src/calculate";
import type { PhotometricData } from "../../photometry/src/types";
import type { CalcResults } from "../../solver/src/types";
import {
  GOLDEN_FIXTURES,
  GOLDEN_ROOM,
} from "./ab-golden-room";
import { clipResultsToPolygon, roomToCalcOptions } from "./room-adapter";

export function loadGoldenRoomPhotometry(): PhotometricData {
  const text = readFileSync(
    path.join(process.cwd(), "fixtures/sample-downlight.ies"),
    "utf8"
  );
  return parseIes(text).data;
}

export function runGoldenRoomCalculation(): CalcResults {
  const photo = loadGoldenRoomPhotometry();
  const opts = roomToCalcOptions(
    GOLDEN_ROOM,
    GOLDEN_FIXTURES,
    { ab_lum: photo },
    { ab_lum: 30 }
  );
  const raw = calculate(opts);
  return clipResultsToPolygon(GOLDEN_ROOM, raw, opts.luminaires);
}
