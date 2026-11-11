/**
 * Generate AED-180297 L9M sample .evo for manual DIALux verification.
 * Run: npx tsx scripts/export-l9m-evo-artifact.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { buildDialuxEvo, defaultEvoFixtureRoot } from "@luxsim/project-io";
import { defaultSceneV2 } from "../packages/project-io/src/migrate";
import { rectPolygon } from "../packages/project-io/src/geometry";

async function main() {
  const scene = defaultSceneV2();
  const storeyId = scene.storeys[0]!.id;
  const rooms = [
    ["Reception & Waiting", 0, 0, 4.2, 7.2],
    ["Server Room", 5, 0, 3.8, 3.9],
    ["14P Meeting Room", 10, 0, 4.8, 5.3],
    ["Collaboration", 0, 8, 10.4, 7.2],
    ["Dry Pantry", 12, 8, 5.3, 4.5],
    ["Utility 70 SQFT", 0, 16, 11, 4.2],
    ["Store Room", 12, 14, 4.5, 4.6],
    ["Utility 30 SQFT", 18, 0, 3.8, 3.4],
    ["Open Office", 18, 5, 6.2, 7.8],
  ] as const;
  rooms.forEach(([name, x, y, w, d], i) => {
    scene.rooms.push({
      id: `l9m_${i}`,
      storeyId,
      name,
      polygon: rectPolygon(x, y, w, d),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: false,
      },
    });
  });

  const { blob, warnings } = await buildDialuxEvo({
    projectName: "AED-180297 L9M",
    scene,
    fixtureRoot: defaultEvoFixtureRoot(),
  });

  const outDir = "/opt/cursor/artifacts";
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "AED-180297_L9M_from_LUXSIM.evo");
  const notePath = path.join(outDir, "AED-180297_L9M_from_LUXSIM_R5_NOTES.md");
  writeFileSync(outPath, Buffer.from(await blob.arrayBuffer()));
  console.log("Wrote", outPath, "warnings:", warnings);
  writeFileSync(
    notePath,
    `# R5 identity-safe export\n\nSee PR #3 exporter. Regenerate diff with:\n\n\`\`\`bash\npython3 scripts/evo-diff-vs-official.py ${outPath}\n\`\`\`\n`
  );
}

void main();
