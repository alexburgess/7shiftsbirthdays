import os from "node:os";
import path from "node:path";

import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import { AppConfig } from "../../src/config.js";
import { CacheStore } from "../../src/store/cacheStore.js";
import { CacheSnapshot } from "../../src/types.js";

describe("HTTP routes", () => {
  const routeTest = typeof Bun !== "undefined" ? it.skip : it;

  afterEach(() => {
    vi.useRealTimers();
  });

  routeTest("serves health, index, and company ICS feed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00.000Z"));

    const config: AppConfig = {
      port: 4000,
      baseUrl: "https://calendar.example.com",
      publicPathPrefix: "/calendar/7shifts/birthdays",
      contactsPathPrefix: "/contacts/carddav",
      contactsBookName: "7shifts Staff",
      timezone: "America/New_York",
      horizonYears: 10,
      sevenShiftsApiBaseUrl: "https://api.7shifts.com/v2",
      sevenShiftsAccessToken: "token",
      privateAuthUsername: "admin",
      privateAuthPassword: "secret",
      cacheFilePath: path.join(os.tmpdir(), "route-test-cache.json")
    };

    const store = new CacheStore(config.cacheFilePath);

    const snapshot: CacheSnapshot = {
      lastSyncedAt: "2026-03-17T00:00:00.000Z",
      timezone: "America/New_York",
      horizonYears: 10,
      contacts: {
        bookName: "7shifts Staff",
        contacts: [
          {
            uid: "contact-1@7shifts-birthday-calendar",
            firstName: "Alex",
            lastName: "Burgess",
            fullName: "Alex Burgess",
            companyName: "Downtown",
            companyNames: ["Downtown"],
            email: "alex@example.com",
            phone: "+15551234567",
            birthday: {
              year: 1992,
              month: 5,
              day: 11
            },
            rev: "2026-03-17T00:00:00.000Z"
          }
        ]
      },
      companies: {
        "123": {
          companyId: "123",
          companyName: "Downtown",
          people: [
            {
              companyId: "123",
              userId: "10",
              fullName: "Alex Burgess",
              month: 5,
              day: 11,
              birthYear: 1992
            }
          ],
          missingBirthdayPeople: [
            {
              companyId: "123",
              userId: "11",
              firstName: "Casey",
              lastName: "Stone",
              fullName: "Casey Stone"
            }
          ],
          ics: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
        }
      }
    };

    store.setSnapshot(snapshot);
    const app = createApp({ config, store });
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");

    const landing = await request(app).get("/");
    expect(landing.status).toBe(200);
    expect(landing.headers["content-type"]).toContain("text/html");
    expect(landing.text).toContain("birthdaycalendar.me");
    expect(landing.text).toContain("Copy URL");
    expect(landing.text).not.toContain("Manual Refresh");
    expect(landing.text).not.toContain("Casey Stone");
    expect(landing.text).not.toContain("CardDAV for iPhone Contacts");
    expect(landing.text).not.toContain("Subscription Page");

    const adminUnauthorized = await request(app).get("/admin");
    expect(adminUnauthorized.status).toBe(401);

    const admin = await request(app).get("/admin").auth("admin", "secret");
    expect(admin.status).toBe(200);
    expect(admin.text).toContain("Manual Refresh");
    expect(admin.text).toContain("Show Missing Birthdays (1)");
    expect(admin.text).toContain("Casey Stone");
    expect(admin.text).toContain("https://app.7shifts.com/employers/employee/11");
    expect(admin.text).toContain("Open Profile");
    expect(admin.text).toContain("Birthday Trends");
    expect(admin.text).toContain("Most Popular Single Day");
    expect(admin.text).toContain("By Month");
    expect(admin.text).toContain("CardDAV for iPhone Contacts");
    expect(admin.text).toContain("Copy Username");

    const index = await request(app).get("/calendar/7shifts/birthdays");
    expect(index.status).toBe(200);
    expect(index.body.companies).toHaveLength(1);
    expect(index.body.companies[0].icsUrl).toBe(
      "https://calendar.example.com/calendar/7shifts/birthdays/123.ics"
    );

    const trmnlFeed = await request(app).get("/trmnl/birthdays.json");
    expect(trmnlFeed.status).toBe(200);
    expect(trmnlFeed.body.scope.companyName).toBe("Downtown");
    expect(trmnlFeed.body.totalBirthdays).toBe(1);
    expect(trmnlFeed.body.birthdays).toHaveLength(1);
    expect(trmnlFeed.body.birthdays[0]).toMatchObject({
      companyId: "123",
      companyName: "Downtown",
      userId: "10",
      fullName: "Alex Burgess",
      month: 5,
      day: 11,
      birthYear: 1992,
      age: 34
    });

    const scopedTrmnlFeed = await request(app).get("/trmnl/birthdays.json?companyId=123");
    expect(scopedTrmnlFeed.status).toBe(200);
    expect(scopedTrmnlFeed.body.scope.companyId).toBe("123");
    expect(scopedTrmnlFeed.body.birthdays).toHaveLength(1);

    const missingTrmnlFeed = await request(app).get("/trmnl/birthdays.json?companyId=999");
    expect(missingTrmnlFeed.status).toBe(404);

    const calendar = await request(app).get("/calendar/7shifts/birthdays/123.ics");
    expect(calendar.status).toBe(200);
    expect(calendar.headers["content-type"]).toContain("text/calendar");

    const missing = await request(app).get("/calendar/7shifts/birthdays/999.ics");
    expect(missing.status).toBe(404);

    const unauthorizedRefresh = await request(app).post("/refresh");
    expect(unauthorizedRefresh.status).toBe(401);

    const contactUnauthorized = await request(app).get("/contacts/carddav/addressbooks/employees/contact-1%407shifts-birthday-calendar.vcf");
    expect(contactUnauthorized.status).toBe(401);

    const contact = await request(app)
      .get("/contacts/carddav/addressbooks/employees/contact-1%407shifts-birthday-calendar.vcf")
      .auth("admin", "secret");
    expect(contact.status).toBe(200);
    expect(contact.headers["content-type"]).toContain("text/vcard");
    expect(contact.text).toContain("FN:Alex Burgess");
    expect(contact.text).toContain("EMAIL:alex@example.com");

    const propfindServer = app.listen(0);

    try {
      const address = propfindServer.address();
      if (!address || typeof address === "string") {
        throw new Error("Unable to bind test server.");
      }

      const propfindResponse = await fetch(`http://127.0.0.1:${address.port}/contacts/carddav/addressbooks/employees/`, {
        method: "PROPFIND",
        headers: {
          Authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
          Depth: "1"
        }
      });

      expect(propfindResponse.status).toBe(207);
      expect(propfindResponse.headers.get("content-type")).toContain("application/xml");
      const propfindBody = await propfindResponse.text();
      expect(propfindBody).toContain("/contacts/carddav/addressbooks/employees/");
      expect(propfindBody).toContain("contact-1@7shifts-birthday-calendar.vcf");

      const rootPropfindResponse = await fetch(`http://127.0.0.1:${address.port}/`, {
        method: "PROPFIND",
        headers: {
          Authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
          Depth: "0"
        }
      });

      expect(rootPropfindResponse.status).toBe(207);
      expect(rootPropfindResponse.headers.get("content-type")).toContain("application/xml");
      const rootPropfindBody = await rootPropfindResponse.text();
      expect(rootPropfindBody).toContain("/contacts/carddav/principals/admin/");
      expect(rootPropfindBody).toContain("/contacts/carddav/addressbooks/");
    } finally {
      await new Promise<void>((resolve, reject) => {
        propfindServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
