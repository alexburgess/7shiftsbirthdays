import { describe, expect, it } from "vitest";

import { BirthdayPerson } from "../../src/types.js";
import { buildBirthdayFunStats } from "../../src/utils/birthdayStats.js";

describe("buildBirthdayFunStats", () => {
  it("aggregates birthdays across month, week, weekday, and most-popular day", () => {
    const people: BirthdayPerson[] = [
      { companyId: "1", userId: "10", fullName: "Alex Burgess", month: 1, day: 5, birthYear: 1992 },
      { companyId: "1", userId: "11", fullName: "Casey Stone", month: 1, day: 5, birthYear: 1994 },
      { companyId: "1", userId: "12", fullName: "Jamie Lane", month: 2, day: 29, birthYear: 1990 },
      { companyId: "1", userId: "13", fullName: "Morgan Reed", month: 7, day: 4, birthYear: 1991 }
    ];

    const stats = buildBirthdayFunStats(people, 2025);

    expect(stats.byMonth[0].count).toBe(2);
    expect(stats.byMonth[1].count).toBe(1);
    expect(stats.byMonth[6].count).toBe(1);

    expect(stats.busiestMonth?.label).toBe("January");
    expect(stats.busiestWeek?.label).toBe("Week 1");
    expect(stats.busiestWeekday?.label).toBe("Sunday");
    expect(stats.mostPopularDay).toEqual({
      label: "January 5",
      count: 2,
      tiedDays: 0,
      tiedLabels: []
    });

    const weekOne = stats.byWeek.find((bucket) => bucket.label === "Week 1");
    const weekNine = stats.byWeek.find((bucket) => bucket.label === "Week 9");
    const weekTwentySeven = stats.byWeek.find((bucket) => bucket.label === "Week 27");
    expect(weekOne?.count).toBe(2);
    expect(weekNine?.count).toBe(1);
    expect(weekTwentySeven?.count).toBe(1);
  });

  it("includes the tied top dates when multiple days share the same highest count", () => {
    const people: BirthdayPerson[] = [
      { companyId: "1", userId: "10", fullName: "Alex Burgess", month: 1, day: 5 },
      { companyId: "1", userId: "11", fullName: "Casey Stone", month: 1, day: 5 },
      { companyId: "1", userId: "12", fullName: "Jamie Lane", month: 2, day: 14 },
      { companyId: "1", userId: "13", fullName: "Morgan Reed", month: 2, day: 14 },
      { companyId: "1", userId: "14", fullName: "Taylor Hart", month: 7, day: 4 }
    ];

    const stats = buildBirthdayFunStats(people, 2025);

    expect(stats.mostPopularDay).toEqual({
      label: "January 5",
      count: 2,
      tiedDays: 1,
      tiedLabels: ["February 14"]
    });
  });
});
