import { AppConfig } from "../config.js";
import { logger } from "../logger.js";
import { CacheStore } from "../store/cacheStore.js";
import { BirthdayPerson, CacheSnapshot, CompanySnapshot } from "../types.js";
import { buildBirthdayCalendarIcs } from "../utils/ics.js";
import { parseBirthDate } from "../utils/date.js";
import { SevenShiftsClient, SevenShiftsUser } from "./sevenShiftsClient.js";

export interface SyncResult {
  syncedAt: string;
  companyCount: number;
  fetchedUserCount: number;
  birthdayCount: number;
  durationMs: number;
}

function getStringProperty(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" ? value.trim() : undefined;
}

function buildUserFullName(user: SevenShiftsUser): string {
  const firstName = getStringProperty(user, "first_name");
  const lastName = getStringProperty(user, "last_name");
  const displayName = getStringProperty(user, "name") || getStringProperty(user, "display_name");

  const fromParts = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fromParts) {
    return fromParts;
  }

  if (displayName) {
    return displayName;
  }

  const id = user.id;
  return `User ${String(id)}`;
}

function isActiveEmployee(user: SevenShiftsUser): boolean {
  const statusRaw = user.status;
  if (typeof statusRaw === "string") {
    const status = statusRaw.toLowerCase();
    if (status !== "active") {
      return false;
    }
  }

  if (typeof user.active === "boolean" && !user.active) {
    return false;
  }

  const typeRaw = user.user_type ?? user.type ?? user.role;
  if (typeof typeRaw === "string") {
    const type = typeRaw.toLowerCase();
    if (type.includes("manager") || type.includes("admin") || type.includes("assistant")) {
      return false;
    }
  }

  return true;
}

function toBirthdayPerson(companyId: string, user: SevenShiftsUser): BirthdayPerson | null {
  const parsed = parseBirthDate(user.birth_date ?? user.date_of_birth);
  if (!parsed) {
    return null;
  }

  const id = user.id;
  if (typeof id !== "string" && typeof id !== "number") {
    return null;
  }

  return {
    companyId,
    userId: String(id),
    fullName: buildUserFullName(user),
    month: parsed.month,
    day: parsed.day,
    // 7shifts uses 1900 as a sentinel when the real birth year is unknown.
    birthYear: parsed.birthYear === 1900 ? undefined : parsed.birthYear
  };
}

function dedupePeople(people: BirthdayPerson[]): BirthdayPerson[] {
  const seen = new Set<string>();
  const output: BirthdayPerson[] = [];

  for (const person of people) {
    const key = `${person.companyId}:${person.userId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(person);
  }

  return output.sort((a, b) => {
    if (a.month !== b.month) {
      return a.month - b.month;
    }
    if (a.day !== b.day) {
      return a.day - b.day;
    }
    return a.fullName.localeCompare(b.fullName);
  });
}

function buildCompanySnapshot(
  companyId: string,
  companyName: string,
  people: BirthdayPerson[],
  activeEmployeeCount: number,
  fetchedUserCount: number,
  config: AppConfig
): CompanySnapshot {
  return {
    companyId,
    companyName,
    people,
    activeEmployeeCount,
    fetchedUserCount,
    ics: buildBirthdayCalendarIcs(companyName, people, {
      timezone: config.timezone,
      horizonYears: config.horizonYears
    })
  };
}

export async function performBirthdaySync(
  config: AppConfig,
  store: CacheStore,
  fetchFn?: typeof fetch
): Promise<SyncResult> {
  if (!config.sevenShiftsAccessToken) {
    throw new Error("SEVENSHIFTS_ACCESS_TOKEN is required for sync.");
  }

  const startedAt = Date.now();
  const client = new SevenShiftsClient({
    baseUrl: config.sevenShiftsApiBaseUrl,
    accessToken: config.sevenShiftsAccessToken,
    fetchFn
  });

  const companies = await client.listCompanies();
  const snapshotCompanies: Record<string, CompanySnapshot> = {};

  let fetchedUserCount = 0;
  let birthdayCount = 0;

  for (const company of companies) {
    const users = await client.listUsers(company.id);
    fetchedUserCount += users.length;
    const activeUsers = users.filter((user) => isActiveEmployee(user));

    const people = dedupePeople(
      activeUsers
        .map((user) => toBirthdayPerson(company.id, user))
        .filter((person): person is BirthdayPerson => person !== null)
    );

    birthdayCount += people.length;

    snapshotCompanies[company.id] = buildCompanySnapshot(
      company.id,
      company.name,
      people,
      activeUsers.length,
      users.length,
      config
    );

    logger.info("company_sync_complete", {
      companyId: company.id,
      companyName: company.name,
      usersFetched: users.length,
      activeEmployees: activeUsers.length,
      birthdaysIncluded: people.length
    });
  }

  const syncedAt = new Date().toISOString();
  const snapshot: CacheSnapshot = {
    lastSyncedAt: syncedAt,
    timezone: config.timezone,
    horizonYears: config.horizonYears,
    companies: snapshotCompanies
  };

  await store.persistSnapshot(snapshot);

  const result: SyncResult = {
    syncedAt,
    companyCount: companies.length,
    fetchedUserCount,
    birthdayCount,
    durationMs: Date.now() - startedAt
  };

  logger.info("sync_complete", {
    syncedAt: result.syncedAt,
    companyCount: result.companyCount,
    fetchedUserCount: result.fetchedUserCount,
    birthdayCount: result.birthdayCount,
    durationMs: result.durationMs
  });
  return result;
}
