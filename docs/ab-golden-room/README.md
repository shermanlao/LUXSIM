# AB golden room — LUXSIM ↔ DIALux evo

Fixed indoor reference case for manual AB tests. **Not** a CIE 171 or EN 12464 certificate.

## Geometry

| Parameter | Value |
|-----------|--------|
| Footprint | 5 m × 4 m rectangle, origin (0,0) |
| Height | 2.8 m |
| Workplane | 0.75 m |
| ρ floor / walls / ceiling | 0.20 / 0.50 / 0.70 |
| Grid spacing | 0.5 m |
| Interreflection | on, 2 bounces |
| Maintenance factor (EN assist) | 0.80 (LLMF×LSF×LMF×RSMF default) |

## Luminaires

| ID | IES file | W | Position (m) x,y,z | Rotation ° |
|----|----------|---|---------------------|------------|
| A | `fixtures/sample-downlight.ies` | 30 | 2.5, 2.0, 2.7 | 30 |
| B | same | 30 | 1.2, 3.1, 2.7 | 120 |

Mounting height z = 2.7 m (ceiling − 0.1 m).

## LUXSIM expected (initial calc, Oct 2026 solver)

Regenerate: `npm run ab-golden:refresh` (or run `ab-golden-room.test.ts` after updating constants).

| Metric | Value |
|--------|-------|
| Ēm (eave) | **186.1 lx** |
| Emin | 59.5 lx |
| Emax | 405.6 lx |
| Uo | **0.32** |
| UGR (assist) | **27.7** |
| Maintained Ēm (× MF 0.8) | **148.9 lx** |
| LPD | 3.0 W/m² |

Machine-readable: [`luxsim-expected.csv`](./luxsim-expected.csv), [`room-spec.csv`](./room-spec.csv), [`fixtures.csv`](./fixtures.csv).

## DIALux evo setup (manual)

1. Closed rectangular room **5×4 m**, height **2.8 m**, same reflectances.
2. Set **MF = 0.80** (fixed) to match LUXSIM maintained column.
3. Import **`fixtures/sample-downlight.ies`** twice (or duplicate luminaire).
4. Place at table coordinates; apply **rotation** (C0/plan rotation per DIALux UI).
5. Workplane **0.75 m**; calculate direct + interreflection as available.
6. Compare DIALux **maintained** average lux to **148.9 lx** order-of-magnitude; UGR and Uo will **not** match exactly (different UGR model / radiosity).

## Code entry point

`runGoldenRoomCalculation()` in `packages/project-io/src/ab-golden-room.ts` — used by `ab-golden-room.test.ts`.
