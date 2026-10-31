# Server-side solver migration (post-validation)

**Status:** Deferred until the client path is proven working.

## When to start

After Phase 4 hardening:

- [ ] Sample rooms calculate without UI freeze (Web Worker)
- [ ] Results visually sane vs a DIALux reference room
- [ ] Export PDF / luxsim / DIALux pack smoke-tested
- [ ] No dual physics: still one `packages/solver`

## Plan

1. Add `POST /api/calculate` (or a background job) that imports `calculate` from `@luxsim/solver`.
2. Run fixture scenes on client and server; assert summaries match within tolerance.
3. Optionally route heavy grids to server; keep client for interactive preview.
4. Do **not** rewrite the solver for Node — reuse the same package.

## Explicit non-goals until then

- No `/api/calculate` in v1
- No server radiosity service
- No GPU cluster
