import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AppConfig } from "../../src/config.js";
import { performBirthdaySync } from "../../src/services/birthdaySync.js";
import { CacheStore } from "../../src/store/cacheStore.js";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("performBirthdaySync", () => {
  it("syncs companies, filters users, and persists ICS snapshots", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "birthday-sync-"));
    const cacheFilePath = path.join(tmpDir, "cache.json");
    const store = new CacheStore(cacheFilePath);

    const config: AppConfig = {
      port: 4000,
      baseUrl: "https://example.com",
      publicPathPrefix: "/calendar/7shifts/birthdays",
      timezone: "America/New_York",
      horizonYears: 10,
      sevenShiftsApiBaseUrl: "https://api.example.test/v2",
      sevenShiftsAccessToken: "token",
      cacheFilePath
    };

    const fetchCalls: string[] = [];

    const fetchFn: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      fetchCalls.push(url);

      if (url.includes("/companies")) {
        return jsonResponse({
          data: [
            { id: 1, name: "Downtown" },
            { id: 2, name: "Uptown" }
          ]
        });
      }

      if (url.includes("/company/1/users")) {
        return jsonResponse({
          data: [
            { id: 10, first_name: "Alex", last_name: "Burgess", status: "active", birth_date: "1992-05-11" },
            { id: 13, first_name: "Zoe", last_name: "Adams", status: "active" },
            { id: 14, first_name: "Aaron", last_name: "Young", status: "active", birth_date: "" },
            { id: 11, first_name: "Manager", last_name: "Person", role: "manager", status: "active", birth_date: "1980-01-01" },
            { id: 12, first_name: "Inactive", last_name: "User", status: "inactive", birth_date: "1988-12-12" }
          ]
        });
      }

      if (url.includes("/company/2/users")) {
        return jsonResponse({
          data: [
            { id: 20, first_name: "No", last_name: "Year", status: "active", date_of_birth: "1910-07-04" }
          ]
        });
      }

      return jsonResponse({ error: "not found" }, 404);
    };

    const result = await performBirthdaySync(config, store, fetchFn);
    const snapshot = store.getSnapshot();

    expect(result.companyCount).toBe(2);
    expect(result.birthdayCount).toBe(2);
    expect(snapshot.lastSyncedAt).not.toBeNull();
    expect(Object.keys(snapshot.companies)).toEqual(["1", "2"]);
    expect(snapshot.companies["1"].people).toHaveLength(1);
    expect(snapshot.companies["1"].activeEmployeeCount).toBe(3);
    expect(snapshot.companies["1"].fetchedUserCount).toBe(5);
    expect(snapshot.companies["1"].ics).toContain("Alex Burgess's");
    expect(snapshot.companies["1"].missingBirthdayPeople).toEqual([
      {
        companyId: "1",
        userId: "14",
        firstName: "Aaron",
        lastName: "Young",
        fullName: "Aaron Young"
      },
      {
        companyId: "1",
        userId: "13",
        firstName: "Zoe",
        lastName: "Adams",
        fullName: "Zoe Adams"
      }
    ]);
    expect(snapshot.companies["2"].ics).toContain("No Year's Birthday");
    expect(snapshot.companies["2"].ics).not.toContain("116th Birthday");
    expect(snapshot.companies["2"].missingBirthdayPeople).toEqual([]);

    const persisted = JSON.parse(await fs.readFile(cacheFilePath, "utf8"));
    expect(persisted.lastSyncedAt).toBe(snapshot.lastSyncedAt);
    expect(fetchCalls.some((url) => url.includes("/companies"))).toBe(true);
  });
});
