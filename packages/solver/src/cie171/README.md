# CIE 171 validation harness (skeleton)

CIE 171 defines numerical test cases for lighting calculation software. LUXSIM does **not** ship the full CIE reference suite in this repository.

## Phase 1 (this repo)

| Case ID | Description | Status |
|---------|-------------|--------|
| `direct-inverse-square` | Single nadir source, E = I cos(i) / r² at workplane point | **Implemented** — analytical golden |
| `direct-offset` | Source offset horizontally; cos(i) reduces lux | **Implemented** — analytical golden |
| `interreflection-box` | Multi-bounce room | Deferred — simplified kernel only |
| `CIE171-table-*` | Published reference numbers from standard tables | Deferred — requires licensed reference data |

## Phase 2+

- Import selected official CIE 171 cases when reference vectors are available
- Mesh radiosity / photon map parity cases
- Outdoor / road cases (out of indoor scope)

Run tests: `npm test -- packages/solver/src/cie171`
