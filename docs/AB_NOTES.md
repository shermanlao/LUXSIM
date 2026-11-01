# LUXSIM ↔ DIALux evo AB notes (Oct 2026)

Sherman ran a live **DIALux evo 12.1** vs **LUXSIM** comparison. This doc records what we learned and what LUXSIM changed — not a claim of parity.

## DIALux observations (reference)

| Topic | DIALux behaviour |
|--------|------------------|
| Workflow | Mode bar: Construction → Light → Calculation objects → Export |
| Rooms | Rectangular / polygon rooms must be **closed**; open contour / zero width fails lighting |
| Light mode | Full luminaire tools need **space/room** view, not site-only |
| Calculation | Fails with emergency-only luminaires or no suitable fixtures |
| Site | Example defaults: Hong Kong location, **MF ≈ 0.80** (fixed) |

## LUXSIM fixes in this pass (PR #1 follow-up)

| Item | Change |
|------|--------|
| Fixture rotation | Properties: rotation ° + ±90°; Top view arrow; `rotation_deg` in schedule.csv; solver already used `rotationDeg` |
| Mode bar | Construction / Light / Calculation / Export — soft panel filters + hints (LUXSIM branding only) |
| MF | Default **0.80** on room calc; explicit in Properties, `rooms.json`, results-summary CSV; **not** applied inside direct solver (maintained checks only) |
| Verification zip | Richer README (closed space, normal luminaires, rotation, MF); `getDialuxPackWarnings`; block export on open contours |
| Honesty | README + this doc: expect divergence — LUXSIM uses direct + simplified box interreflection, not DIALux radiosity |

## Still different (do not expect match)

- Radiosity / multi-bounce accuracy vs DIALux
- UGR observer model (simplified)
- No calculation objects / wall grids / daylight
- No emergency scenes or manufacturer catalog
- No native DIALux project read/write
- Polygon rooms use AABB grid + clip (not DIALux room kernel)

## Golden-room AB tip

For a fair-ish check: same closed rectangle, same IES, same positions **and rotation_deg**, same workplane height, reflectance, and DIALux MF = LUXSIM `maintenanceFactor`. Compare DIALux maintained results to LUXSIM **maintained_eave_lx** column (initial calc × MF), not raw solver grid alone.
