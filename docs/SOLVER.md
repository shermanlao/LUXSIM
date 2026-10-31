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

## Non-claims

- Not EN 12464 certified
- Not a substitute for DIALux / Relux / AGi32 on tender work
- Validate critical numbers in certified software

## Grid limits

Default spacing 0.5 m; clamp 0.25–2 m to keep client performance acceptable.
