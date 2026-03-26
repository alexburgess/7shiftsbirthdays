import { describe, expect, it } from "vitest";

import { buildBirthdaySummary } from "../../src/utils/ics.js";

describe("buildBirthdaySummary", () => {
  it("includes ordinal age when birth year is known", () => {
    expect(buildBirthdaySummary("Alex Burgess", 1992, 2026)).toBe("Alex Burgess's 34th Birthday");
  });

  it("omits age when 1900 is used as the birth year sentinel", () => {
    expect(buildBirthdaySummary("Alex Burgess", 1900, 2026)).toBe("Alex Burgess's Birthday");
  });

  it("omits age when 1910 is used as the birth year sentinel", () => {
    expect(buildBirthdaySummary("Alex Burgess", 1910, 2026)).toBe("Alex Burgess's Birthday");
  });

  it("falls back to non-age title when birth year is missing", () => {
    expect(buildBirthdaySummary("Alex Burgess", undefined, 2026)).toBe("Alex Burgess's Birthday");
  });
});
