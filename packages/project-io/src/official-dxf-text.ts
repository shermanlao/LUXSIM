import { isDxfLayoutBlockName } from "./dxf";
import {
  officialDxfLayerName,
  officialExtractVisibleCadEntities,
  officialInsertExplodedLayer,
} from "./official-dxf-layers";
import {
  officialDxfEntityToWorld,
  type OfficialDxfWorldUnderlay,
} from "./official-dxf-world";
import type { Vec2 } from "./types";

export type OfficialDxfTextKind = "TEXT" | "MTEXT" | "ATTRIB";

/** Model-space CAD text in drawing units (not yet scaled to scene metres). */
export type OfficialDxfTextLabel = {
  text: string;
  x: number;
  y: number;
  rotationDeg: number;
  layer?: string;
  kind: OfficialDxfTextKind;
};

type OfficialDxfInsert = {
  name: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  columns: number;
  rows: number;
  colSpacing: number;
  rowSpacing: number;
  layer?: string;
};

type OfficialDxfBlockItem =
  | { kind: "label"; label: OfficialDxfTextLabel }
  | { kind: "insert"; insert: OfficialDxfInsert };

type OfficialDxfBlockDef = {
  name: string;
  base: Vec2;
  items: OfficialDxfBlockItem[];
};

function isFiniteNumber(n: number): boolean {
  return Number.isFinite(n);
}

/**
 * Strip DXF TEXT/MTEXT formatting codes so the remaining string can be
 * normalized as a fixture code. Paragraph breaks become spaces. MTEXT font
 * and paragraph overrides (`\\P`, `\\pxqc;`, `{\\f…;…}`, `^J`) are removed.
 * A few common `%%` specials are expanded. Residual braces and one-letter
 * commands are dropped. This is deterministic, not a full MTEXT renderer.
 */
export function officialStripDxfText(raw: string, kind: OfficialDxfTextKind = "TEXT"): string {
  let s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (kind === "MTEXT" || kind === "ATTRIB") {
    s = s.replace(/\^J/g, " ");
    s = s.replace(/\\~/g, " ");
    // Semicolon-terminated commands first (\pxqc;, \A1;, \H2.5x;) so
    // a leading \\p is not mistaken for the paragraph break \\P.
    s = s.replace(/\\[A-Za-z][^;\\{}]*;/g, "");
    for (let n = 0; n < 8; n += 1) {
      const next = s.replace(/\{[^{}]*\}/g, (chunk) =>
        chunk.replace(/^\{(?:\\[^;{}]*;)*/, "").replace(/\}$/, "")
      );
      if (next === s) break;
      s = next;
    }
    s = s.replace(/\\[A-Za-z][^;\\{}]*;/g, "");
    s = s.replace(/[{}]/g, "");
    s = s.replace(/\\P/g, " ");
  }
  s = s.replace(/%%[UuOo]/g, "");
  s = s.replace(/%%[Dd]/g, "°");
  s = s.replace(/%%[Cc]/g, "Ø");
  s = s.replace(/%%[Pp]/g, "±");
  s = s.replace(/%%(\d{3})/g, (_all, digits: string) =>
    String.fromCharCode(Number(digits))
  );
  return s.replace(/\s+/g, " ").trim();
}

/** MTEXT group 50, or the 11/21 direction vector when 50 is omitted. */
export function officialDxfMtextRotationDeg(
  group50: number | undefined,
  directionX: number | undefined,
  directionY: number | undefined
): number {
  if (group50 != null && isFiniteNumber(group50)) return group50;
  if (
    directionX != null &&
    directionY != null &&
    isFiniteNumber(directionX) &&
    isFiniteNumber(directionY) &&
    (directionX !== 0 || directionY !== 0)
  ) {
    return (Math.atan2(directionY, directionX) * 180) / Math.PI;
  }
  return 0;
}

/**
 * TEXT insertion is group 10/20 when both justifications are 0 (left /
 * baseline). Otherwise the alignment point 11/21 is used when it is finite.
 * MTEXT always uses the group 10/20 attachment point.
 */
export function officialDxfTextInsertionPoint(input: {
  kind: OfficialDxfTextKind;
  x: number;
  y: number;
  alignX?: number;
  alignY?: number;
  horizJust?: number;
  vertJust?: number;
}): Vec2 {
  if (input.kind === "MTEXT") {
    return { x: input.x, y: input.y };
  }
  const horiz = input.horizJust ?? 0;
  const vert = input.vertJust ?? 0;
  if (
    (horiz !== 0 || vert !== 0) &&
    input.alignX != null &&
    input.alignY != null &&
    isFiniteNumber(input.alignX) &&
    isFiniteNumber(input.alignY)
  ) {
    return { x: input.alignX, y: input.alignY };
  }
  return { x: input.x, y: input.y };
}

function applyDxfInsertTransform(
  point: Vec2,
  insert: OfficialDxfInsert,
  base: Vec2,
  column: number,
  row: number
): Vec2 {
  const dx = (point.x - base.x) * insert.scaleX;
  const dy = (point.y - base.y) * insert.scaleY;
  const rad = (insert.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ox =
    insert.x + column * insert.colSpacing * cos - row * insert.rowSpacing * sin;
  const oy =
    insert.y + column * insert.colSpacing * sin + row * insert.rowSpacing * cos;
  return { x: ox + dx * cos - dy * sin, y: oy + dx * sin + dy * cos };
}

function explodeDxfTextInserts(
  inserts: OfficialDxfInsert[],
  blocks: Map<string, OfficialDxfBlockDef>
): OfficialDxfTextLabel[] {
  const labelsFromBlock = (name: string, stack: string[]): OfficialDxfTextLabel[] => {
    const key = name.trim().toUpperCase();
    if (!key || stack.includes(key)) return [];
    const block = blocks.get(key);
    if (!block) return [];
    const next = [...stack, key];
    const out: OfficialDxfTextLabel[] = [];
    for (const item of block.items) {
      if (item.kind === "label") out.push(item.label);
      else out.push(...explodeOne(item.insert, next));
    }
    return out;
  };
  const explodeOne = (insert: OfficialDxfInsert, stack: string[]): OfficialDxfTextLabel[] => {
    const locals = labelsFromBlock(insert.name, stack);
    const block = blocks.get(insert.name.trim().toUpperCase());
    const base = block?.base ?? { x: 0, y: 0 };
    const columns = Math.max(1, Math.floor(insert.columns) || 1);
    const rows = Math.max(1, Math.floor(insert.rows) || 1);
    if (columns * rows > 10_000) return [];
    const out: OfficialDxfTextLabel[] = [];
    for (let c = 0; c < columns; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        for (const label of locals) {
          const point = applyDxfInsertTransform(
            { x: label.x, y: label.y },
            insert,
            base,
            c,
            r
          );
          out.push({
            ...label,
            x: point.x,
            y: point.y,
            rotationDeg: label.rotationDeg + insert.rotationDeg,
            layer: officialInsertExplodedLayer(label.layer, insert.layer),
          });
        }
      }
    }
    return out;
  };
  return inserts.flatMap((insert) => explodeOne(insert, []));
}

/**
 * Extract model-space TEXT, MTEXT, and ATTRIB values that follow an INSERT
 * (group 66 = 1) from an official DXF (including a DWG after official
 * conversion). Paperspace (group 67 = 1) is skipped, the same as linework.
 * TEXT/MTEXT inside block definitions are exploded through model-space
 * INSERT (nested INSERT, array, scale, rotation, and layer-0 inheritance).
 * Positions are in drawing units. Empty or whitespace-only text (after
 * formatting is stripped) is ignored.
 *
 * ATTDEF default values inside blocks are not exploded in this increment
 * (a leftover): converted plans often store unreliable tag/value pairs, and
 * visible attribute values are already collected from ATTRIB after INSERT.
 */
export function parseDxfTextLabels(text: string): OfficialDxfTextLabel[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const labels: OfficialDxfTextLabel[] = [];
  const blocks = new Map<string, OfficialDxfBlockDef>();
  const modelInserts: OfficialDxfInsert[] = [];
  let i = 0;
  let section: string | null = null;
  let currentBlock: OfficialDxfBlockDef | null = null;
  const hasEntitiesSection = lines.some(
    (line, idx) =>
      line.trim() === "2" && (lines[idx + 1] ?? "").trim().toUpperCase() === "ENTITIES"
  );

  const readPair = (): { code: number; value: string } | null => {
    if (i + 1 >= lines.length) return null;
    const code = Number(lines[i++]!.trim());
    const value = lines[i++] ?? "";
    if (!Number.isFinite(code)) return null;
    return { code, value: value.trim() };
  };

  const unreadPair = () => {
    i -= 2;
  };

  const readGroups = (onGroup: (code: number, value: string) => void) => {
    while (i < lines.length) {
      const p = readPair();
      if (!p) break;
      if (p.code === 0) {
        unreadPair();
        break;
      }
      onGroup(p.code, p.value);
    }
  };

  const readEntityGroups = (
    onGroup: (code: number, value: string) => void
  ): { paperspace: boolean } => {
    let paperspace = false;
    lastEntityLayer = undefined;
    readGroups((code, value) => {
      if (code === 8) lastEntityLayer = officialDxfLayerName(value);
      if (code === 67 && Number(value) === 1) paperspace = true;
      onGroup(code, value);
    });
    return { paperspace };
  };

  const inModelEntities = () =>
    section === "ENTITIES" || (!hasEntitiesSection && section == null);

  let lastEntityLayer: string | undefined;

  const emitLabel = (label: OfficialDxfTextLabel | null) => {
    if (!label) return;
    const named: OfficialDxfTextLabel = {
      ...label,
      layer: officialDxfLayerName(label.layer ?? lastEntityLayer),
    };
    if (currentBlock) {
      currentBlock.items.push({ kind: "label", label: named });
      return;
    }
    if (inModelEntities()) labels.push(named);
  };

  const emitInsert = (insert: OfficialDxfInsert) => {
    if (!insert.name) return;
    if (currentBlock) {
      currentBlock.items.push({ kind: "insert", insert });
      return;
    }
    if (inModelEntities()) modelInserts.push(insert);
  };

  const makeLabel = (input: {
    kind: OfficialDxfTextKind;
    raw: string;
    x: number;
    y: number;
    rotationDeg: number;
    alignX?: number;
    alignY?: number;
    horizJust?: number;
    vertJust?: number;
    layer?: string;
  }): OfficialDxfTextLabel | null => {
    const stripped = officialStripDxfText(input.raw, input.kind);
    if (!stripped) return null;
    if (!isFiniteNumber(input.x) || !isFiniteNumber(input.y)) return null;
    const point = officialDxfTextInsertionPoint({
      kind: input.kind,
      x: input.x,
      y: input.y,
      alignX: input.alignX,
      alignY: input.alignY,
      horizJust: input.horizJust,
      vertJust: input.vertJust,
    });
    if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;
    return {
      text: stripped,
      x: point.x,
      y: point.y,
      rotationDeg: isFiniteNumber(input.rotationDeg) ? input.rotationDeg : 0,
      layer: input.layer ?? lastEntityLayer,
      kind: input.kind,
    };
  };

  const readAttribsUntilSeqend = (paperspaceInsert: boolean) => {
    while (i < lines.length) {
      const p = readPair();
      if (!p) break;
      if (p.code !== 0) continue;
      const t = p.value.toUpperCase();
      if (t === "SEQEND") {
        readGroups(() => {});
        break;
      }
      if (t === "ATTRIB") {
        let raw = "";
        let x = 0;
        let y = 0;
        let rotationDeg = 0;
        let alignX: number | undefined;
        let alignY: number | undefined;
        let horizJust = 0;
        let vertJust = 0;
        let hasX = false;
        let hasY = false;
        const { paperspace } = readEntityGroups((code, value) => {
          if (code === 1 && raw === "") raw = value;
          if (code === 10 && !hasX) {
            x = Number(value);
            hasX = true;
          }
          if (code === 20 && !hasY) {
            y = Number(value);
            hasY = true;
          }
          if (code === 11) alignX = Number(value);
          if (code === 21) alignY = Number(value);
          if (code === 50) rotationDeg = Number(value);
          if (code === 72) horizJust = Number(value);
          if (code === 74) vertJust = Number(value);
        });
        if (paperspaceInsert || paperspace) continue;
        emitLabel(
          makeLabel({
            kind: "ATTRIB",
            raw,
            x,
            y,
            rotationDeg,
            alignX,
            alignY,
            horizJust,
            vertJust,
          })
        );
        continue;
      }
      readGroups(() => {});
    }
  };

  while (i < lines.length) {
    const pair = readPair();
    if (!pair) break;
    if (pair.code !== 0) continue;
    const type = pair.value.toUpperCase();
    lastEntityLayer = undefined;

    if (type === "SECTION") {
      let name = "";
      readGroups((code, value) => {
        if (code === 2) name = value;
      });
      section = name.toUpperCase() || null;
      currentBlock = null;
      continue;
    }
    if (type === "ENDSEC") {
      readGroups(() => {});
      section = null;
      currentBlock = null;
      continue;
    }
    if (type === "BLOCK") {
      let name = "";
      let x = 0;
      let y = 0;
      readGroups((code, value) => {
        if (code === 2) name = value;
        if (code === 10) x = Number(value);
        if (code === 20) y = Number(value);
      });
      if (section === "BLOCKS" && name && !isDxfLayoutBlockName(name)) {
        currentBlock = {
          name,
          base: {
            x: isFiniteNumber(x) ? x : 0,
            y: isFiniteNumber(y) ? y : 0,
          },
          items: [],
        };
        blocks.set(name.trim().toUpperCase(), currentBlock);
      } else {
        currentBlock = null;
      }
      continue;
    }
    if (type === "ENDBLK") {
      readGroups(() => {});
      currentBlock = null;
      continue;
    }
    if (type === "INSERT") {
      let name = "";
      let x = 0;
      let y = 0;
      let scaleX = 1;
      let scaleY = 1;
      let hasScaleY = false;
      let rotationDeg = 0;
      let columns = 1;
      let rows = 1;
      let colSpacing = 0;
      let rowSpacing = 0;
      let attribsFollow = false;
      const { paperspace } = readEntityGroups((code, value) => {
        if (code === 2) name = value;
        if (code === 8) lastEntityLayer = officialDxfLayerName(value);
        if (code === 10) x = Number(value);
        if (code === 20) y = Number(value);
        if (code === 41) scaleX = Number(value);
        if (code === 42) {
          scaleY = Number(value);
          hasScaleY = true;
        }
        if (code === 50) rotationDeg = Number(value);
        if (code === 70) columns = Number(value);
        if (code === 71) rows = Number(value);
        if (code === 44) colSpacing = Number(value);
        if (code === 45) rowSpacing = Number(value);
        if (code === 66 && Number(value) === 1) attribsFollow = true;
      });
      if (attribsFollow) readAttribsUntilSeqend(paperspace);
      if (paperspace) continue;
      const sx = isFiniteNumber(scaleX) && scaleX !== 0 ? scaleX : 1;
      emitInsert({
        name,
        x: isFiniteNumber(x) ? x : 0,
        y: isFiniteNumber(y) ? y : 0,
        scaleX: sx,
        scaleY: hasScaleY && isFiniteNumber(scaleY) && scaleY !== 0 ? scaleY : sx,
        rotationDeg: isFiniteNumber(rotationDeg) ? rotationDeg : 0,
        columns: Number.isFinite(columns) && columns >= 1 ? columns : 1,
        rows: Number.isFinite(rows) && rows >= 1 ? rows : 1,
        colSpacing: isFiniteNumber(colSpacing) ? colSpacing : 0,
        rowSpacing: isFiniteNumber(rowSpacing) ? rowSpacing : 0,
        layer: lastEntityLayer,
      });
      continue;
    }

    if (type === "TEXT" || type === "ATTRIB") {
      let raw = "";
      let x = 0;
      let y = 0;
      let hasX = false;
      let hasY = false;
      let rotationDeg = 0;
      let alignX: number | undefined;
      let alignY: number | undefined;
      let horizJust = 0;
      let vertJust = 0;
      const { paperspace } = readEntityGroups((code, value) => {
        if (code === 1 && raw === "") raw = value;
        if (code === 10 && !hasX) {
          x = Number(value);
          hasX = true;
        }
        if (code === 20 && !hasY) {
          y = Number(value);
          hasY = true;
        }
        if (code === 11) alignX = Number(value);
        if (code === 21) alignY = Number(value);
        if (code === 50) rotationDeg = Number(value);
        if (code === 72) horizJust = Number(value);
        // TEXT vertical just is 73; ATTRIB uses 74.
        if (code === 73 || code === 74) vertJust = Number(value);
      });
      if (paperspace) continue;
      // Bare ATTRIB in ENTITIES (not after INSERT) is still collected.
      emitLabel(
        makeLabel({
          kind: type === "ATTRIB" ? "ATTRIB" : "TEXT",
          raw,
          x,
          y,
          rotationDeg,
          alignX,
          alignY,
          horizJust,
          vertJust,
        })
      );
      continue;
    }

    if (type === "MTEXT") {
      const chunks3: string[] = [];
      let raw1 = "";
      let x = 0;
      let y = 0;
      let hasX = false;
      let hasY = false;
      let group50: number | undefined;
      let dirX: number | undefined;
      let dirY: number | undefined;
      let hasDirX = false;
      let hasDirY = false;
      const { paperspace } = readEntityGroups((code, value) => {
        if (code === 3) chunks3.push(value);
        if (code === 1 && raw1 === "") raw1 = value;
        if (code === 10 && !hasX) {
          x = Number(value);
          hasX = true;
        }
        if (code === 20 && !hasY) {
          y = Number(value);
          hasY = true;
        }
        if (code === 50 && group50 == null) group50 = Number(value);
        if (code === 11 && !hasDirX) {
          dirX = Number(value);
          hasDirX = true;
        }
        if (code === 21 && !hasDirY) {
          dirY = Number(value);
          hasDirY = true;
        }
      });
      if (paperspace) continue;
      emitLabel(
        makeLabel({
          kind: "MTEXT",
          raw: chunks3.join("") + raw1,
          x,
          y,
          rotationDeg: officialDxfMtextRotationDeg(group50, dirX, dirY),
        })
      );
      continue;
    }

    // Skip any other entity, including ATTDEF (leftover).
    readGroups(() => {});
  }

  return [...labels, ...explodeDxfTextInserts(modelInserts, blocks)];
}

export function officialDxfTextLabelsToWorld(
  labels: OfficialDxfTextLabel[],
  underlay?: OfficialDxfWorldUnderlay
): OfficialDxfTextLabel[] {
  return labels.map((label) => {
    const point = officialDxfEntityToWorld({ x: label.x, y: label.y }, underlay);
    return { ...label, x: point.x, y: point.y };
  });
}

export function officialVisibleDxfTextLabels(
  labels: OfficialDxfTextLabel[],
  hiddenLayers?: Iterable<string> | null
): OfficialDxfTextLabel[] {
  return officialExtractVisibleCadEntities(labels, hiddenLayers);
}

/** True when a cached asset-meta value is a parsed label list (including empty). */
export function officialIsDxfTextLabelList(value: unknown): value is OfficialDxfTextLabel[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as OfficialDxfTextLabel;
    return (
      typeof row.text === "string" &&
      Number.isFinite(row.x) &&
      Number.isFinite(row.y) &&
      (row.rotationDeg == null || Number.isFinite(row.rotationDeg)) &&
      (row.kind == null ||
        row.kind === "TEXT" ||
        row.kind === "MTEXT" ||
        row.kind === "ATTRIB")
    );
  });
}
