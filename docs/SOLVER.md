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

### Interreflection

Lightweight box-room boost from area-weighted mean reflectance and a few bounce energy decays. **Not** full mesh radiosity.

### UGR

Simplified CIE 117-style observers looking toward room center. Design-assist only.

## Non-claims

- Not EN 12464 certified
- Not a substitute for DIALux / Relux / AGi32 on tender work
- Validate critical numbers in certified software

## Grid limits

Default spacing 0.5 m; clamp 0.25–2 m to keep client performance acceptable.
