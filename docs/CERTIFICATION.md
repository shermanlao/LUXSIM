# LUXSIM certification roadmap (software)

LUXSIM is a **browser lighting design assist**. This document maps Phase 0–2 work toward software-level alignment with common industry practice (EN 12464 assist, CIE maintenance, CIE 117 UGR hints, CIE 171 self-tests). It is **not** a product certificate.

## Non-claims

- Not EN 12464-1 certified.
- Not ISO/IEC 17050-1 conformity declaration.
- UGR and illuminance numbers are not tender-grade unless verified in DIALux / Relux / AGi32.

## Phase 0 (baseline)

- Multi-room editor, client direct + box interreflection, DIALux verification zip, AB workflow modes.

## Phase 1 (this PR)

| Area | Deliverable |
|------|-------------|
| CIE 97 MF | `maintenance-factor.ts` — LLMF×LSF×LMF×RSMF → clamp 0.5–1.0; UI breakdown |
| EN 12464 assist | Task / surrounding / background targets; honest nulls without second grid |
| CIE 117 UGR | Documented simplified observers; Lb from workplane proxy; golden-room band test |
| CIE 171 skeleton | `packages/solver/src/cie171/` analytical direct cases |
| AB golden room | `docs/ab-golden-room/` + `ab-golden-room.ts` test fixture |
| Docs | This file, `SOLVER.md`, `DIALUX_GAP.md`, `AB_NOTES.md` |

## Phase 2+ (deferred)

- Full CIE 171 table cases (licensed reference vectors)
- Secondary calculation planes in UI (surrounding / background grids)
- Radiosity or photon-map kernel upgrade
- Outdoor / emergency / daylight modules
- ISO 17050 declaration pack (legal / QA process outside code)

## Verification

```bash
npm test
npm run ab-golden:refresh   # optional: print new golden numbers
```

Compare manual Dialux runs using [`docs/ab-golden-room/README.md`](./ab-golden-room/README.md).
