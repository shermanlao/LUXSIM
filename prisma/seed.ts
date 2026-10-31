import "dotenv/config";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import path from "path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseIes } from "../packages/photometry/src/index";
import { defaultSceneV2, rectPolygon } from "../packages/project-io/src/index";
import { saveTextFile } from "../src/lib/storage";
import { UI_TIPS } from "../src/lib/ui-tips";

const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const filePath = dbUrl.startsWith("file:")
  ? path.resolve(process.cwd(), dbUrl.slice("file:".length))
  : dbUrl;

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: filePath }),
});

async function main() {
  const email = "demo@luxsim.local";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash("demo1234", 10);
    user = await prisma.user.create({
      data: {
        email,
        name: "Demo User",
        passwordHash,
      },
    });
  } else {
    console.log("Demo user already exists:", email);
  }

  let membership = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    include: { org: { include: { luminaires: true } } },
  });

  const iesText = readFileSync(
    path.join(process.cwd(), "fixtures/sample-downlight.ies"),
    "utf8"
  );
  const { data } = parseIes(iesText);

  if (!membership) {
    const fileKey = await saveTextFile("luminaires", "sample-downlight.ies", iesText);
    const org = await prisma.org.create({
      data: {
        name: "Demo Studio",
        members: { create: { userId: user.id, role: "owner" } },
        luminaires: {
          create: {
            name: "Sample axial downlight 30W",
            sourceFormat: "ies",
            fileKey,
            originalName: "sample-downlight.ies",
            photometricJson: JSON.stringify(data),
            watts: data.watts,
            lumens: data.luminousFlux,
          },
        },
      },
      include: { luminaires: true },
    });
    membership = await prisma.orgMember.findFirst({
      where: { orgId: org.id, userId: user.id },
      include: { org: { include: { luminaires: true } } },
    });
  }

  const org = membership!.org;
  let lumId = org.luminaires[0]?.id;
  if (!lumId) {
    const fileKey = await saveTextFile("luminaires", "sample-downlight.ies", iesText);
    const lum = await prisma.luminaire.create({
      data: {
        orgId: org.id,
        name: "Sample axial downlight 30W",
        sourceFormat: "ies",
        fileKey,
        originalName: "sample-downlight.ies",
        photometricJson: JSON.stringify(data),
        watts: data.watts,
        lumens: data.luminousFlux,
      },
    });
    lumId = lum.id;
  }
  const scene = defaultSceneV2();
  const storeyId = scene.storeys[0]!.id;
  const roomA = "seed_room_a";
  const roomB = "seed_room_b";
  scene.rooms = [
    {
      id: roomA,
      storeyId,
      name: "Office A",
      polygon: rectPolygon(0, 0, 6, 5),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: true,
      },
    },
    {
      id: roomB,
      storeyId,
      name: "Meeting B",
      polygon: rectPolygon(7, 0, 5, 4),
      heightM: 2.8,
      workplaneHeightM: 0.75,
      reflectance: { floor: 0.2, ceiling: 0.7, walls: 0.5 },
      calc: {
        gridSpacing: 0.5,
        interreflection: true,
        bounces: 2,
        computeUgr: true,
      },
    },
  ];
  scene.fixtureLibraryIds = [lumId];
  scene.instances = [
    {
      instanceId: "seed-i1",
      luminaireId: lumId,
      storeyId,
      roomId: roomA,
      name: "Sample downlight",
      position: { x: 2, y: 2, z: 2.6 },
      rotationDeg: 0,
    },
    {
      instanceId: "seed-i2",
      luminaireId: lumId,
      storeyId,
      roomId: roomA,
      name: "Sample downlight",
      position: { x: 4, y: 3, z: 2.6 },
      rotationDeg: 0,
    },
    {
      instanceId: "seed-i3",
      luminaireId: lumId,
      storeyId,
      roomId: roomB,
      name: "Sample downlight",
      position: { x: 9.5, y: 2, z: 2.6 },
      rotationDeg: 0,
    },
  ];
  scene.ui.activeRoomId = roomA;
  scene.ui.viewMode = "top";

  // Second storey empty for demo
  const l1 = "seed_storey_l1";
  scene.storeys.push({ id: l1, name: "L1", elevationM: 3.2, heightM: 3 });

  const existingProject = await prisma.project.findFirst({
    where: { orgId: org.id, name: "Seed multi-room office" },
  });
  if (existingProject) {
    await prisma.project.update({
      where: { id: existingProject.id },
      data: {
        sceneJson: JSON.stringify(scene),
        resultsJson: JSON.stringify({ version: 2, byRoomId: {} }),
      },
    });
    console.log("Updated project: Seed multi-room office");
  } else {
    await prisma.project.create({
      data: {
        orgId: org.id,
        name: "Seed multi-room office",
        sceneJson: JSON.stringify(scene),
        resultsJson: JSON.stringify({ version: 2, byRoomId: {} }),
      },
    });
    console.log("Created project: Seed multi-room office (2 rooms + L1 storey)");
  }

  for (const tip of UI_TIPS) {
    await prisma.uiTip.upsert({
      where: { helpKey: tip.helpKey },
      update: { title: tip.title, body: tip.body },
      create: { helpKey: tip.helpKey, title: tip.title, body: tip.body },
    });
  }
  console.log(`Upserted ${UI_TIPS.length} UI tips`);

  console.log("Demo login: demo@luxsim.local / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
