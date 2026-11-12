# Solver notes

## Runtime (v1)

- **Client-only** via `packages/solver` inside a Web Worker
- Server stores `resultsJson` after the browser calculates
- Package is environment-agnostic TypeScript (no `fs` / Node APIs) so it can later run on a server worker

## Methods

### Direct illuminance

For each workplane grid point, sample candela \(I(\theta,\phi)\) from the IES/LDT table and apply:

\[
E = \frac{I \cos i}{r^2}
\]

Analytical self-checks: `packages/solver/src/cie171/direct-analytical.test.ts`.

### Interreflection

Lightweight box-room boost from area-weighted mean reflectance and a few bounce energy decays. **Not** full mesh radiosity.

### UGR (CIE 117 assist)

Simplified unified glare rating for design hints only:

- Six observer positions at **1.2 m** eye height, view direction toward room centre (not full 19-position CIE layout).
- Background luminance **Lb** from workplane illuminance: \(L_b \approx \rho_{bg} E / \pi\) with \(\rho_{bg} \approx 0.35\), minimum 3 cd/m².
- Luminaire luminous area estimated from flux / peak intensity when not explicit.
- **Not** certified UGR — do not use for tender glare limits without DIALux / Relux verification.

See `packages/solver/src/ugr.test.ts` and AB golden room in `docs/ab-golden-room/`.

### Maintenance factor

Solver uses **initial** lamp output. Maintained illuminance for EN assist = calculated × MF (CIE 97 product from room settings).


### Wall / vertical calculation surfaces

When a room is calculated, LUXSIM automatically builds one vertical calculation surface per wall of the floor polygon (DIALux evo “Automatically select room main surfaces” practice, without DIALux branding).

- Colinear or gently turning segments (≤ 20°) merge into one surface, so a faceted curve stays one wall. CAD fillets shorter than 0.15 m are absorbed into the neighbouring wall. Sharp corners start a new surface.
- Grid spacing matches the workplane (default 0.50 m). The first point is inset by the existing wall-zone (default 0.25 m = gridSpacing/2). EN 12464-1 allows a 0.5 m edge band; 0.25 m is kept so short walls still receive a grid. A wall shorter than two insets gets a single mid-length column.
- Surface normals point into the room. Direct illuminance uses the existing `directIlluminance` with that vertical normal.
- Results are stored in `ResultsV2.wallsByRoomId` beside, not inside, the workplane `CalcResults`. Workplane statistics are never overwritten by the wall pass.

### Wall interreflection

The workplane still uses the uniform box-room boost (`interreflectedWorkplaneBoost`); that path and its numbers are left untouched. Walls use `interreflectedWallBoost`: the same area-weighted mean reflectance and bounce decay, but a wall-specific form factor (ceiling / floor / other-wall weighted) plus a small contribution from light already arriving on that wall. The boost is uniform over the wall. This is design-assist, not radiosity, and is not a DIN 18599 or flux-balance calculation.

## Non-claims

- Not EN 12464 certified
- Not a substitute for DIALux / Relux / AGi32 on tender work
- Validate critical numbers in certified software

## Grid limits

Default spacing 0.5 m; clamp 0.25–2 m to keep client performance acceptable.
