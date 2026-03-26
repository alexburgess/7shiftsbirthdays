import express, { NextFunction, Request, Response } from "express";

import { AppConfig } from "./config.js";
import { logger } from "./logger.js";
import { performBirthdaySync } from "./services/birthdaySync.js";
import { CacheStore } from "./store/cacheStore.js";
import { BirthdayIndexEntry } from "./types.js";
import { renderLandingPage } from "./utils/landingPage.js";

interface AppDependencies {
  config: AppConfig;
  store: CacheStore;
}

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncRoute(handler: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}

function trimTrailingSlash(value: string): string {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }
  return value;
}

function buildIcsUrl(baseUrl: string, pathPrefix: string, companyId: string): string {
  const base = trimTrailingSlash(baseUrl);
  return `${base}${pathPrefix}/${encodeURIComponent(companyId)}.ics`;
}

function toWebcalUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "webcal://");
}

function buildQrUrl(webcalUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(webcalUrl)}`;
}

export function createApp({ config, store }: AppDependencies) {
  const app = express();
  app.disable("x-powered-by");
  let refreshPromise: Promise<void> | null = null;

  function buildLandingData() {
    const snapshot = store.getSnapshot();
    const companies = Object.values(snapshot.companies)
      .map((company) => {
        const icsUrl = buildIcsUrl(config.baseUrl, config.publicPathPrefix, company.companyId);
        const webcalUrl = toWebcalUrl(icsUrl);

        return {
          companyId: company.companyId,
          companyName: company.companyName,
          birthdaysOnCalendar: company.people.length,
          activeEmployeeCount: company.activeEmployeeCount ?? 0,
          fetchedUserCount: company.fetchedUserCount ?? 0,
          icsUrl,
          webcalUrl,
          qrUrl: buildQrUrl(webcalUrl)
        };
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));

    return {
      lastSyncedAt: snapshot.lastSyncedAt,
      totalBirthdays: companies.reduce((sum, company) => sum + company.birthdaysOnCalendar, 0),
      totalActiveEmployees: companies.reduce((sum, company) => sum + company.activeEmployeeCount, 0),
      totalUsersFetched: companies.reduce((sum, company) => sum + company.fetchedUserCount, 0),
      companies
    };
  }

  app.get(
    "/",
    asyncRoute(async (_req, res) => {
      await store.maybeReloadFromDisk();
      const html = renderLandingPage(buildLandingData());

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    })
  );

  app.post(
    "/refresh",
    asyncRoute(async (_req, res) => {
      if (refreshPromise) {
        res.status(409).json({
          error: "refresh_in_progress",
          message: "A refresh is already running."
        });
        return;
      }

      refreshPromise = (async () => {
        await performBirthdaySync(config, store);
      })();

      try {
        await refreshPromise;
        res.status(200).json({
          status: "ok",
          message: "Refresh completed.",
          lastSyncedAt: store.getSnapshot().lastSyncedAt
        });
      } finally {
        refreshPromise = null;
      }
    })
  );

  app.get("/health", (_req, res) => {
    const snapshot = store.getSnapshot();
    res.status(200).json({
      status: "ok",
      lastSyncedAt: snapshot.lastSyncedAt
    });
  });

  app.get(
    config.publicPathPrefix,
    asyncRoute(async (_req, res) => {
      await store.maybeReloadFromDisk();
      const snapshot = store.getSnapshot();

      const companies: BirthdayIndexEntry[] = Object.values(snapshot.companies)
        .map((company) => ({
          companyId: company.companyId,
          companyName: company.companyName,
          icsUrl: buildIcsUrl(config.baseUrl, config.publicPathPrefix, company.companyId),
          lastSyncedAt: snapshot.lastSyncedAt
        }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName));

      res.status(200).json({
        lastSyncedAt: snapshot.lastSyncedAt,
        companies
      });
    })
  );

  app.get(
    `${config.publicPathPrefix}/:companyId.ics`,
    asyncRoute(async (req, res) => {
      await store.maybeReloadFromDisk();
      const companyIdParam = req.params.companyId;
      const companyId = Array.isArray(companyIdParam) ? companyIdParam[0] : companyIdParam;
      const company = store.getCompany(companyId);

      if (!company) {
        res.status(404).json({
          error: "not_found",
          message: `No birthday calendar found for company ${companyId}.`
        });
        return;
      }

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="birthdays-${companyId}.ics"`);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.status(200).send(company.ics);
    })
  );

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("http_error", {
      error: err instanceof Error ? err.message : String(err)
    });
    res.status(500).json({
      error: "internal_error",
      message: "Unexpected server error."
    });
  });

  return app;
}
