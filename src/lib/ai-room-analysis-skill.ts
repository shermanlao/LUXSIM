import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Official room-analysis skill text loaded from docs/ai-room-analysis-skill.md.
 * The fallback is used only when the file cannot be read at runtime; keep it
 * in sync with that document.
 */
export const ROOM_ANALYSIS_AI_SKILL_FALLBACK = `You analyse an imported architectural or lighting plan after a local search found no room layout. Return only official simple room polygons with no holes, in official scene metres, as JSON {"rooms":[{"polygon":[{"x":0,"y":0},...]}]}. Each room needs at least three unique corners, must not cross itself, and must have area of at least 1 m². Do not create rooms from ceiling-grid cells, title blocks, furniture, or invent rooms that are not on the plan. If none can be identified, return {"rooms":[]}.`;

let cached: string | null = null;

export function loadRoomAnalysisAiSkill(): string {
  if (cached) return cached;
  try {
    const text = readFileSync(
      path.join(process.cwd(), "docs/ai-room-analysis-skill.md"),
      "utf8"
    ).trim();
    if (text.length > 0) {
      cached = text;
      return cached;
    }
  } catch {
    // Fall through to the embedded copy so analysis can still run.
  }
  cached = ROOM_ANALYSIS_AI_SKILL_FALLBACK;
  return cached;
}
