import fs from "node:fs/promises";
import path from "node:path";

import { CacheSnapshot, CompanySnapshot } from "../types.js";

function emptySnapshot(): CacheSnapshot {
  return {
    lastSyncedAt: null,
    timezone: "America/New_York",
    horizonYears: 10,
    companies: {}
  };
}

export class CacheStore {
  private snapshot: CacheSnapshot = emptySnapshot();
  private readonly snapshotPath: string;
  private lastLoadedMtimeMs = 0;

  constructor(snapshotPath: string) {
    this.snapshotPath = snapshotPath;
  }

  getSnapshotPath(): string {
    return this.snapshotPath;
  }

  getSnapshot(): CacheSnapshot {
    return this.snapshot;
  }

  getCompany(companyId: string): CompanySnapshot | undefined {
    return this.snapshot.companies[companyId];
  }

  setSnapshot(snapshot: CacheSnapshot): void {
    this.snapshot = snapshot;
  }

  async loadFromDisk(): Promise<boolean> {
    try {
      const raw = await fs.readFile(this.snapshotPath, "utf8");
      const parsed = JSON.parse(raw) as CacheSnapshot;

      if (!parsed || typeof parsed !== "object" || !parsed.companies) {
        return false;
      }

      this.snapshot = parsed;
      const stat = await fs.stat(this.snapshotPath);
      this.lastLoadedMtimeMs = stat.mtimeMs;
      return true;
    } catch {
      return false;
    }
  }

  async maybeReloadFromDisk(): Promise<boolean> {
    try {
      const stat = await fs.stat(this.snapshotPath);
      if (stat.mtimeMs <= this.lastLoadedMtimeMs) {
        return false;
      }
      return this.loadFromDisk();
    } catch {
      return false;
    }
  }

  async persistSnapshot(snapshot: CacheSnapshot): Promise<void> {
    const directory = path.dirname(this.snapshotPath);
    await fs.mkdir(directory, { recursive: true });

    const tmpPath = `${this.snapshotPath}.tmp`;
    const body = JSON.stringify(snapshot, null, 2);

    await fs.writeFile(tmpPath, body, "utf8");
    await fs.rename(tmpPath, this.snapshotPath);

    this.snapshot = snapshot;
    const stat = await fs.stat(this.snapshotPath);
    this.lastLoadedMtimeMs = stat.mtimeMs;
  }
}
