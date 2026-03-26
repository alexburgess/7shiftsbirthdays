import { loadConfig } from "../config.js";
import { logger } from "../logger.js";
import { performBirthdaySync } from "../services/birthdaySync.js";
import { CacheStore } from "../store/cacheStore.js";

async function run(): Promise<void> {
  const config = loadConfig();
  if (!config.sevenShiftsAccessToken) {
    throw new Error("SEVENSHIFTS_ACCESS_TOKEN is required.");
  }

  const store = new CacheStore(config.cacheFilePath);
  await store.loadFromDisk();

  const result = await performBirthdaySync(config, store);
  logger.info("manual_sync_finished", {
    syncedAt: result.syncedAt,
    companyCount: result.companyCount,
    fetchedUserCount: result.fetchedUserCount,
    birthdayCount: result.birthdayCount,
    durationMs: result.durationMs
  });
}

run().catch((error) => {
  logger.error("manual_sync_failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
