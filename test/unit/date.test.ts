import { describe, expect, it } from "vitest";

import {
  computeAge,
  normalizeBirthdayForYear,
  ordinal,
  parseBirthDate
} from "../../src/utils/date.js";

describe("date utils", () => {
  it("formats ordinal suffixes", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(22)).toBe("22nd");
  });

  it("computes ages safely", () => {
    expect(computeAge(1990, 2026)).toBe(36);
    expect(computeAge(2028, 2026)).toBeUndefined();
  });

  it("maps leap day birthdays to february 28 on non-leap years", () => {
    expect(normalizeBirthdayForYear(2, 29, 2027)).toEqual({ month: 2, day: 28 });
    expect(normalizeBirthdayForYear(2, 29, 2028)).toEqual({ month: 2, day: 29 });
  });

  it("parses supported birth date formats", () => {
    expect(parseBirthDate("1992-05-11")).toEqual({ month: 5, day: 11, birthYear: 1992 });
    expect(parseBirthDate("05-11")).toEqual({ month: 5, day: 11 });
    expect(parseBirthDate("5/11/1992")).toEqual({ month: 5, day: 11, birthYear: 1992 });
    expect(parseBirthDate("5/11")).toEqual({ month: 5, day: 11 });
    expect(parseBirthDate("invalid")).toBeNull();
  });
});
