import { readFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import { parseIes, parseLdt, resolvedFlux } from "../packages/photometry/src/index";
import { absolutePath } from "../src/lib/storage";

const db = new DatabaseSync("dev.db");
const rows = db.prepare("SELECT id, fileKey, sourceFormat FROM Luminaire").all() as {
  id: string;
  fileKey: string;
  sourceFormat: string;
}[];

const update = db.prepare(
  "UPDATE Luminaire SET photometricJson = ?, lumens = ? WHERE id = ?"
);

for (const row of rows) {
  const filePath = absolutePath(row.fileKey);
  const text = readFileSync(filePath, "utf8");
  const { data } = row.sourceFormat === "ldt" ? parseLdt(text) : parseIes(text);
  const flux = resolvedFlux(data);
  update.run(JSON.stringify(data), flux, row.id);
  console.log(row.id, row.fileKey, "lumens", flux, "open", data.openingWidthM, data.cctK);
}
console.log("refreshed", rows.length);
