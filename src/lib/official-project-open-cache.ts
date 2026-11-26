import type {
  OfficialEditorAssetRow,
  OfficialProjectEditorPayload,
} from "@/lib/official-project-editor-state";
import { officialProjectRevisionMatches } from "@/lib/official-project-editor-state";
import type { ProjectSceneV2, ResultsV2 } from "@luxsim/project-io";

/** Keep a small set of recently focused projects, not the whole job list. */
export const OFFICIAL_PROJECT_OPEN_CACHE_MAX = 6;

const DB_NAME = "luxsim-official-project-open";
const DB_VERSION = 1;
const STORE = "snapshots";

export type OfficialCachedProjectOpen = OfficialProjectEditorPayload & {
  userId: string;
  projectId: string;
  accessedAt: number;
};

type StoredRow = OfficialCachedProjectOpen & { cacheKey: string };

function cacheKey(userId: string, projectId: string): string {
  return `${userId}\t${projectId}`;
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "cacheKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open project cache"));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Project cache request failed"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Project cache transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Project cache transaction aborted"));
  });
}

async function withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openCacheDb();
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

function officialIsoFromInput(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as { name?: string; code?: number };
  return rec.name === "QuotaExceededError" || rec.code === 22;
}

function asCached(row: StoredRow | undefined | null): OfficialCachedProjectOpen | null {
  if (!row || typeof row !== "object") return null;
  if (typeof row.userId !== "string" || typeof row.projectId !== "string") return null;
  if (typeof row.updatedAt !== "string" || !row.scene || !row.results) return null;
  if (!Array.isArray(row.assets)) return null;
  return {
    userId: row.userId,
    projectId: row.projectId,
    id: row.id || row.projectId,
    name: typeof row.name === "string" ? row.name : "",
    updatedAt: row.updatedAt,
    scene: row.scene,
    results: row.results,
    assets: row.assets as OfficialEditorAssetRow[],
    accessedAt: typeof row.accessedAt === "number" ? row.accessedAt : 0,
  };
}

function evictOverflow(store: IDBObjectStore, rows: StoredRow[], keepKey: string): void {
  const others = rows.filter((row) => row.cacheKey !== keepKey);
  const overflow = others.length + 1 - OFFICIAL_PROJECT_OPEN_CACHE_MAX;
  if (overflow <= 0) return;
  others
    .slice()
    .sort((a, b) => (a.accessedAt || 0) - (b.accessedAt || 0))
    .slice(0, overflow)
    .forEach((row) => store.delete(row.cacheKey));
}

export async function officialReadCachedProjectOpen(
  userId: string,
  projectId: string
): Promise<OfficialCachedProjectOpen | null> {
  if (!canUseIndexedDb() || !userId || !projectId) return null;
  try {
    return await withDb(async (db) => {
      const tx = db.transaction(STORE, "readonly");
      const row = await requestToPromise<StoredRow | undefined>(
        tx.objectStore(STORE).get(cacheKey(userId, projectId))
      );
      await transactionDone(tx);
      return asCached(row ?? null);
    });
  } catch {
    return null;
  }
}

function putSnapshot(db: IDBDatabase, row: StoredRow, evictHalf: boolean): Promise<void> {
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const req = store.getAll();
  req.onsuccess = () => {
    const rows = ((req.result as StoredRow[]) ?? []).slice();
    if (evictHalf && rows.length > 0) {
      rows
        .slice()
        .sort((a, b) => (a.accessedAt || 0) - (b.accessedAt || 0))
        .slice(0, Math.max(1, Math.ceil(rows.length / 2)))
        .forEach((item) => store.delete(item.cacheKey));
    }
    evictOverflow(store, rows, row.cacheKey);
    store.put(row);
  };
  return transactionDone(tx);
}

export async function officialWriteCachedProjectOpen(input: {
  userId: string;
  projectId: string;
  name: string;
  updatedAt: string;
  scene: ProjectSceneV2;
  results: ResultsV2;
  assets: OfficialEditorAssetRow[];
}): Promise<void> {
  if (!canUseIndexedDb() || !input.userId || !input.projectId || !input.updatedAt) return;
  const row: StoredRow = {
    cacheKey: cacheKey(input.userId, input.projectId),
    userId: input.userId,
    projectId: input.projectId,
    id: input.projectId,
    name: input.name,
    updatedAt: officialIsoFromInput(input.updatedAt),
    scene: input.scene,
    results: input.results,
    assets: input.assets,
    accessedAt: Date.now(),
  };
  try {
    await withDb((db) => putSnapshot(db, row, false));
  } catch (error) {
    if (!isQuotaError(error)) return;
    try {
      await withDb((db) => putSnapshot(db, row, true));
    } catch {
      /* cache is optional — opening still works without it */
    }
  }
}

export async function officialTouchCachedProjectOpen(
  userId: string,
  projectId: string
): Promise<void> {
  if (!canUseIndexedDb() || !userId || !projectId) return;
  try {
    await withDb((db) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(cacheKey(userId, projectId));
      req.onsuccess = () => {
        const existing = req.result as StoredRow | undefined;
        if (!existing) return;
        existing.accessedAt = Date.now();
        store.put(existing);
      };
      return transactionDone(tx);
    });
  } catch {
    /* ignore */
  }
}

export async function officialClearProjectOpenCache(): Promise<void> {
  if (!canUseIndexedDb()) return;
  try {
    await withDb(async (db) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      await transactionDone(tx);
    });
  } catch {
    /* ignore */
  }
}

export { officialProjectRevisionMatches };
