import path from "node:path";

const DEFAULT_PORT = 4000;
const DEFAULT_BASE_URL = `http://localhost:${DEFAULT_PORT}`;
const DEFAULT_PATH_PREFIX = "/calendar/7shifts/birthdays";
const DEFAULT_CONTACTS_PATH_PREFIX = "/contacts/carddav";
const DEFAULT_TIMEZONE = "America/New_York";
const DEFAULT_HORIZON_YEARS = 10;
const DEFAULT_API_BASE_URL = "https://api.7shifts.com/v2";
const DEFAULT_CACHE_FILE = "./data/cache.json";
const DEFAULT_CONTACTS_BOOK_NAME = "7shifts Staff";

export interface AppConfig {
  port: number;
  baseUrl: string;
  publicPathPrefix: string;
  contactsPathPrefix: string;
  contactsBookName: string;
  timezone: string;
  horizonYears: number;
  sevenShiftsApiBaseUrl: string;
  sevenShiftsAccessToken?: string;
  privateAuthUsername?: string;
  privateAuthPassword?: string;
  cacheFilePath: string;
}

function normalizePathPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_PATH_PREFIX;
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = parseNumber(env.PORT, DEFAULT_PORT);

  return {
    port,
    baseUrl: env.BASE_URL?.trim() || DEFAULT_BASE_URL,
    publicPathPrefix: normalizePathPrefix(env.PUBLIC_PATH_PREFIX || DEFAULT_PATH_PREFIX),
    contactsPathPrefix: normalizePathPrefix(env.CONTACTS_PATH_PREFIX || DEFAULT_CONTACTS_PATH_PREFIX),
    contactsBookName: env.CONTACTS_BOOK_NAME?.trim() || DEFAULT_CONTACTS_BOOK_NAME,
    timezone: env.TIMEZONE?.trim() || DEFAULT_TIMEZONE,
    horizonYears: parseNumber(env.HORIZON_YEARS, DEFAULT_HORIZON_YEARS),
    sevenShiftsApiBaseUrl: env.SEVENSHIFTS_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
    sevenShiftsAccessToken: env.SEVENSHIFTS_ACCESS_TOKEN?.trim() || undefined,
    privateAuthUsername: env.PRIVATE_AUTH_USERNAME?.trim() || undefined,
    privateAuthPassword: env.PRIVATE_AUTH_PASSWORD?.trim() || undefined,
    cacheFilePath: path.resolve(env.CACHE_FILE_PATH || DEFAULT_CACHE_FILE)
  };
}
