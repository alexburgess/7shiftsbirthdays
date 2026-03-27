import { timingSafeEqual } from "node:crypto";

import express, { NextFunction, Request, Response } from "express";

import { AppConfig } from "./config.js";
import { logger } from "./logger.js";
import { performBirthdaySync } from "./services/birthdaySync.js";
import { CacheStore } from "./store/cacheStore.js";
import { BirthdayIndexEntry, ContactRecord } from "./types.js";
import { buildBirthdayFunStats } from "./utils/birthdayStats.js";
import {
  buildCardDavPaths,
  buildPropfindDocument,
  buildReportDocument,
  parseCardDavReport
} from "./utils/carddav.js";
import { renderLandingPage } from "./utils/landingPage.js";
import { buildContactVCard, getVCardEtag } from "./utils/vcard.js";

interface AppDependencies {
  config: AppConfig;
  store: CacheStore;
}

interface BasicAuthCredentials {
  username: string;
  password: string;
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

function buildAbsoluteUrl(baseUrl: string, path: string): string {
  const base = trimTrailingSlash(baseUrl);
  return `${base}${path}`;
}

function toWebcalUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "webcal://");
}

function buildQrUrl(webcalUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(webcalUrl)}`;
}

function getReferenceYear(lastSyncedAt: string | null): number {
  if (!lastSyncedAt) {
    return new Date().getFullYear();
  }

  const parsed = new Date(lastSyncedAt);
  return Number.isNaN(parsed.getTime()) ? new Date().getFullYear() : parsed.getUTCFullYear();
}

function compareMissingBirthdayPeople(
  a: { firstName: string; lastName: string; fullName: string; companyName: string },
  b: { firstName: string; lastName: string; fullName: string; companyName: string }
): number {
  const firstNameCompare = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
  if (firstNameCompare !== 0) {
    return firstNameCompare;
  }

  const lastNameCompare = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
  if (lastNameCompare !== 0) {
    return lastNameCompare;
  }

  const fullNameCompare = a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
  if (fullNameCompare !== 0) {
    return fullNameCompare;
  }

  return a.companyName.localeCompare(b.companyName, undefined, { sensitivity: "base" });
}

function getBasicAuthCredentials(config: AppConfig): BasicAuthCredentials | undefined {
  if (!config.privateAuthUsername || !config.privateAuthPassword) {
    return undefined;
  }

  return {
    username: config.privateAuthUsername,
    password: config.privateAuthPassword
  };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseBasicAuthHeader(header: string | undefined): { username: string; password: string } | null {
  if (!header || !header.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function isAuthorized(request: Request, credentials: BasicAuthCredentials): boolean {
  const parsed = parseBasicAuthHeader(request.header("authorization"));
  if (!parsed) {
    return false;
  }

  return safeEqual(parsed.username, credentials.username) && safeEqual(parsed.password, credentials.password);
}

function setDavHeaders(response: Response): void {
  response.setHeader("DAV", "1, 2, addressbook");
  response.setHeader("MS-Author-Via", "DAV");
}

function respondPrivateAuthRequired(response: Response): void {
  response.setHeader("WWW-Authenticate", 'Basic realm="birthdaycalendar.me admin", charset="UTF-8"');
  response.status(401).send("Authentication required.");
}

function respondPrivateAuthUnavailable(response: Response): void {
  response.status(503).send("Private authentication is not configured.");
}

function respondMethodNotAllowed(response: Response, allow: string): void {
  response.setHeader("Allow", allow);
  response.status(405).send("Method not allowed.");
}

function normalizeCardDavRequestPath(requestPath: string, collectionPath: string): string {
  const normalizedCollection = trimTrailingSlash(collectionPath);
  if (requestPath === normalizedCollection) {
    return `${normalizedCollection}/`;
  }

  if (requestPath.startsWith(`${normalizedCollection}/`)) {
    return requestPath;
  }

  return requestPath;
}

function isCollectionRequestPath(requestPath: string, collectionPath: string): boolean {
  return trimTrailingSlash(requestPath) === trimTrailingSlash(collectionPath);
}

function buildCardDavGetText(bookName: string, contactCount: number): string {
  return [
    `${bookName} CardDAV endpoint`,
    "",
    `Contacts available: ${contactCount}`,
    "Use a CardDAV client such as iPhone Contacts with this URL."
  ].join("\n");
}

function matchContactByPath(requestPath: string, addressBookPath: string, contacts: ContactRecord[]): ContactRecord | undefined {
  const relative = requestPath.startsWith(addressBookPath) ? requestPath.slice(addressBookPath.length) : "";
  if (!relative.endsWith(".vcf")) {
    return undefined;
  }

  const uid = decodeURIComponent(relative.slice(0, -4));
  return contacts.find((contact) => contact.uid === uid);
}

export function createApp({ config, store }: AppDependencies) {
  const app = express();
  const basicAuthCredentials = getBasicAuthCredentials(config);
  const cardDavPaths = buildCardDavPaths(config.contactsPathPrefix);
  const cardDavRoutePaths = [config.contactsPathPrefix, `${config.contactsPathPrefix}/*`];
  const cardDavAllowHeader = "OPTIONS, PROPFIND, REPORT, GET, HEAD";
  const cardDavWriteMethods = new Set([
    "ACL",
    "BIND",
    "COPY",
    "DELETE",
    "LOCK",
    "MKCALENDAR",
    "MKCOL",
    "MOVE",
    "PATCH",
    "POST",
    "PROPPATCH",
    "PUT",
    "REBIND",
    "UNBIND",
    "UNLOCK"
  ]);

  app.disable("x-powered-by");
  app.use(
    express.text({
      type: () => true,
      limit: "2mb"
    })
  );

  let refreshPromise: Promise<void> | null = null;

  function requirePrivateAuth(req: Request, res: Response, next: NextFunction): void {
    res.setHeader("Vary", "Authorization");

    if (!basicAuthCredentials) {
      respondPrivateAuthUnavailable(res);
      return;
    }

    if (!isAuthorized(req, basicAuthCredentials)) {
      respondPrivateAuthRequired(res);
      return;
    }

    next();
  }

  function buildLandingData(isAdmin: boolean) {
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

    const missingBirthdayPeople = Object.values(snapshot.companies)
      .flatMap((company) =>
        (company.missingBirthdayPeople ?? []).map((person) => ({
          companyId: company.companyId,
          companyName: company.companyName,
          userId: person.userId,
          firstName: person.firstName,
          lastName: person.lastName,
          fullName: person.fullName
        }))
      )
      .sort(compareMissingBirthdayPeople);

    const allPeople = Object.values(snapshot.companies).flatMap((company) => company.people);
    const contacts = snapshot.contacts?.contacts ?? [];

    return {
      isAdmin,
      lastSyncedAt: snapshot.lastSyncedAt,
      totalBirthdays: companies.reduce((sum, company) => sum + company.birthdaysOnCalendar, 0),
      totalActiveEmployees: companies.reduce((sum, company) => sum + company.activeEmployeeCount, 0),
      totalUsersFetched: companies.reduce((sum, company) => sum + company.fetchedUserCount, 0),
      totalMissingBirthdays: missingBirthdayPeople.length,
      totalContacts: contacts.length,
      birthdayFunStats: buildBirthdayFunStats(allPeople, getReferenceYear(snapshot.lastSyncedAt)),
      missingBirthdayPeople,
      companies,
      adminPath: "/admin",
      refreshPath: "/refresh",
      cardDav:
        isAdmin && basicAuthCredentials
          ? {
              username: basicAuthCredentials.username,
              serverUrl: buildAbsoluteUrl(config.baseUrl, cardDavPaths.rootPath),
              addressBookUrl: buildAbsoluteUrl(config.baseUrl, cardDavPaths.addressBookPath),
              bookName: snapshot.contacts?.bookName ?? config.contactsBookName
            }
          : null
    };
  }

  app.get(
    "/",
    asyncRoute(async (_req, res) => {
      await store.maybeReloadFromDisk();
      const html = renderLandingPage(buildLandingData(false));

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    })
  );

  app.get(
    "/admin",
    requirePrivateAuth,
    asyncRoute(async (_req, res) => {
      await store.maybeReloadFromDisk();
      const html = renderLandingPage(buildLandingData(true));

      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    })
  );

  app.post(
    "/refresh",
    requirePrivateAuth,
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

  app.all("/.well-known/carddav", requirePrivateAuth, (req, res) => {
    setDavHeaders(res);
    res.redirect(307, cardDavPaths.rootPath);
  });

  app.use(cardDavRoutePaths, requirePrivateAuth);
  app.all(
    cardDavRoutePaths,
    asyncRoute(async (req, res) => {
      await store.maybeReloadFromDisk();
      const snapshot = store.getSnapshot();
      const contacts = snapshot.contacts?.contacts ?? [];
      const bookName = snapshot.contacts?.bookName ?? config.contactsBookName;
      const requestPath = normalizeCardDavRequestPath(req.path, cardDavPaths.addressBookPath);

      setDavHeaders(res);

      if (cardDavWriteMethods.has(req.method.toUpperCase())) {
        respondMethodNotAllowed(res, cardDavAllowHeader);
        return;
      }

      if (req.method === "OPTIONS") {
        res.setHeader("Allow", cardDavAllowHeader);
        res.status(204).end();
        return;
      }

      if (req.method === "PROPFIND") {
        const document = buildPropfindDocument({
          paths: cardDavPaths,
          requestPath,
          depth: req.header("depth") ?? "0",
          baseUrl: config.baseUrl,
          bookName,
          username: basicAuthCredentials?.username ?? "admin",
          lastSyncedAt: snapshot.lastSyncedAt,
          contacts
        });

        if (!document) {
          res.status(404).send("Not found.");
          return;
        }

        res.status(207).setHeader("Content-Type", "application/xml; charset=utf-8");
        res.send(document);
        return;
      }

      if (req.method === "REPORT") {
        if (!isCollectionRequestPath(requestPath, cardDavPaths.addressBookPath)) {
          res.status(404).send("Not found.");
          return;
        }

        const body = typeof req.body === "string" ? req.body : "";
        const report = parseCardDavReport(body);
        if (!report.type) {
          res.status(400).send("Unsupported REPORT request.");
          return;
        }

        const document = buildReportDocument({
          paths: cardDavPaths,
          reportType: report.type,
          requestedHrefs: report.hrefs,
          contacts,
          baseUrl: config.baseUrl,
          lastSyncedAt: snapshot.lastSyncedAt
        });

        res.status(207).setHeader("Content-Type", "application/xml; charset=utf-8");
        res.send(document);
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        if (
          isCollectionRequestPath(requestPath, cardDavPaths.rootPath) ||
          isCollectionRequestPath(requestPath, cardDavPaths.principalPath) ||
          isCollectionRequestPath(requestPath, cardDavPaths.addressBookHomePath) ||
          isCollectionRequestPath(requestPath, cardDavPaths.addressBookPath)
        ) {
          const body = buildCardDavGetText(bookName, contacts.length);
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          if (req.method === "HEAD") {
            res.status(200).end();
            return;
          }

          res.status(200).send(body);
          return;
        }

        const contact = matchContactByPath(requestPath, cardDavPaths.addressBookPath, contacts);
        if (!contact) {
          res.status(404).send("Not found.");
          return;
        }

        const vcard = buildContactVCard(contact);
        res.setHeader("Content-Type", "text/vcard; charset=utf-8");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(contact.uid)}.vcf"`);
        res.setHeader("ETag", getVCardEtag(vcard));
        res.setHeader("Cache-Control", "private, max-age=300");

        if (req.method === "HEAD") {
          res.status(200).end();
          return;
        }

        res.status(200).send(vcard);
        return;
      }

      respondMethodNotAllowed(res, cardDavAllowHeader);
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
