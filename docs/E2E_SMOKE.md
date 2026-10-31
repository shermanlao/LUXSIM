# Final E2E smoke checklist

1. `npm ci` → `npx prisma migrate dev` → `npm run db:seed` → `npm run dev`
2. Login `demo@luxsim.local` / `demo1234`
3. Open **Seed multi-room office**
4. Upload IES → confirm it appears in fixture list and **does not** add instances
5. Drag fixture into Office A and Meeting B
6. Switch Top / Front / Side / 3D; fullscreen exit OK
7. Calc all → metrics + false-color on active room
8. Export full PDF + `.luxsim` + DIALux pack
9. New project → set Room height (mm), Draw room: click 4 corners (type mm to lock a side) and close on the start; or Create rectangle L×W then drag it. Confirm height applies in 3D. Pause ~1s and reload — scene should autosave.
10. Import `fixtures/sample-plan.dxf` and/or `fixtures/sample-building.ifc`
11. `npm test` && `npm run build` green
