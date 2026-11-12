# Lighting report (PDF)

LUXSIM’s full PDF export (`buildFullReportPdf` in `@luxsim/project-io`) is structured to align with professional lighting-report **content** (similar to DIALux evo deliverables) while keeping LUXSIM branding and the design-assist disclaimer.

## Sections

1. **Cover** — project title, date, optional organization, LUXSIM version, disclaimer.
2. **Contents**
3. **Project summary** — counts, total polygon floor area, installed power, flux/efficacy when photometry provides flux.
4. **Luminaire list** — project totals (Φ, P, efficacy) and per-product table (pcs, manufacturer, article, Φ, P, lm/W).
5. **Room list** — per room: Ptotal, true polygon ARoom, LPD (W/m² and W/m²/100 lx), Ēperpendicular, luminaire sub-table.
6. **Calculation objects** — all workplanes: type, height, wall zone, Ē, Emin, Emax, Uo, g2.
7. **Per room** — Summary (properties + optional plan/3D/false-color images), Summary results, Working plane (false-color + coordinate schedule).
8. **Product sheets** — polar curve when available; flux shown honestly for absolute IES (-1 lm) files.
9. **Luminaire schedule appendix** — global coordinates.

## Area and LPD

Room area and LPD in the report use **true polygon area** (`roomAreaM2`), not the axis-aligned bounding box used internally for the calc grid. After polygon clipping, `clipResultsToPolygon` overwrites `summary.areaM2` and `summary.lpd`.

## Browser export

The building editor generates false-color workplane PNGs via `gridToFalseColorPngDataUrl` before calling `buildFullReportPdf`. Optional `planSnapshots` / `persp3dSnapshots` data URLs can be supplied when capture is wired up.

See also `fixtures/reference-dialux-report.pdf` and repo `CONTENT_SPEC` notes for field checklist vs official DIALux exports (no branding clone).

## Header and footer

Every page, including the cover and landscape Lighting Plan pages, has a footer with the project name, optional context, section title, and page number. When `ReportInput.website` is set, that address is also printed as plain text in the footer (trailing slash stripped). The building editor reads it from `GET /api/site` (`reportWebsite` site setting; default `AUTH_URL` or `NEXTAUTH_URL`) and passes it into `buildFullReportPdf`. The website is not added to emails, .evo files, CSVs, or other exports.
