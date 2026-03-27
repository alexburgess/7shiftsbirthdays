import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { createApp } from "./app.js";
import { performBirthdaySync } from "./services/birthdaySync.js";
import { CacheStore } from "./store/cacheStore.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const store = new CacheStore(config.cacheFilePath);

  const loaded = await store.loadFromDisk();
  logger.info("cache_load", {
    loaded,
    snapshotPath: store.getSnapshotPath()
  });

  if (config.sevenShiftsAccessToken) {
    try {
      await performBirthdaySync(config, store);
    } catch (error) {
      logger.warn("startup_sync_failed_using_cached_data", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    logger.warn("startup_sync_skipped", {
      reason: "SEVENSHIFTS_ACCESS_TOKEN not set"
    });
  }

  const app = createApp({ config, store });
  const server = app.listen(config.port, () => {
    logger.info("server_started", {
      port: config.port,
      pathPrefix: config.publicPathPrefix,
      contactsPathPrefix: config.contactsPathPrefix,
      timezone: config.timezone,
      horizonYears: config.horizonYears
    });
  });

  const shutdown = (signal: string) => {
    logger.info("server_shutdown_signal", { signal });
    server.close(() => {
      logger.info("server_stopped");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  logger.error("bootstrap_failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
