# LUXSIM

Browser lighting design assist with **multi-storey / multi-room** projects, plan & IFC import, drag-and-drop fixtures, 2D/3D views, client-side lux calculation, and DIALux-style PDF reports.

## Quick start

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Demo: `demo@luxsim.local` / `demo1234`

## Workflow

See [docs/EDITOR_WORKFLOW.md](docs/EDITOR_WORKFLOW.md).

1. New project → import plan (optional) → draw rooms (click corners or L×W)  
2. Upload IES/LDT into fixture list (does **not** auto-place)  
3. Drag fixtures onto rooms (Top / Front / Side / 3D)  
4. Calculate → export full PDF / `.luxsim` / **DIALux verification zip** (multi-room geometry + DXF + CSV)  

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm test` | Unit tests |
| `npm run build` | Production build |
| `npm run db:seed` | Seed demo user + multi-room project |

## Docs

[docs/MARKDOWN_INDEX.md](docs/MARKDOWN_INDEX.md) · [docs/ADMIN.md](docs/ADMIN.md)
