import os from "node:os";
import path from "node:path";

import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { AppConfig } from "../../src/config.js";
import { CacheStore } from "../../src/store/cacheStore.js";
import { CacheSnapshot } from "../../src/types.js";

describe("HTTP routes", () => {
  const routeTest = typeof Bun !== "undefined" ? it.skip : it;

  routeTest("serves health, index, and company ICS feed", async () => {
    const config: AppConfig = {
      port: 4000,
      baseUrl: "https://calendar.example.com",
      publicPathPrefix: "/calendar/7shifts/birthdays",
      timezone: "America/New_York",
      horizonYears: 10,
      sevenShiftsApiBaseUrl: "https://api.7shifts.com/v2",
      sevenShiftsAccessToken: "token",
      cacheFilePath: path.join(os.tmpdir(), "route-test-cache.json")
    };

    const store = new CacheStore(config.cacheFilePath);

    const snapshot: CacheSnapshot = {
      lastSyncedAt: "2026-03-17T00:00:00.000Z",
      timezone: "America/New_York",
      horizonYears: 10,
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
    expect(landing.text).toContain("Manual Refresh");
    expect(landing.text).toContain("Copy URL");
    expect(landing.text).toContain("Show Missing Birthdays (1)");
    expect(landing.text).toContain("Casey Stone");
    expect(landing.text).toContain("https://app.7shifts.com/employers/employee/11");
    expect(landing.text).toContain("Open Profile");
    expect(landing.text).not.toContain("Subscription Page");

    const index = await request(app).get("/calendar/7shifts/birthdays");
    expect(index.status).toBe(200);
    expect(index.body.companies).toHaveLength(1);
    expect(index.body.companies[0].icsUrl).toBe(
      "https://calendar.example.com/calendar/7shifts/birthdays/123.ics"
    );

    const calendar = await request(app).get("/calendar/7shifts/birthdays/123.ics");
    expect(calendar.status).toBe(200);
    expect(calendar.headers["content-type"]).toContain("text/calendar");

    const missing = await request(app).get("/calendar/7shifts/birthdays/999.ics");
    expect(missing.status).toBe(404);
  });
});
