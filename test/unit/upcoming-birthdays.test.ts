import { describe, expect, it } from "vitest";

import { CompanySnapshot } from "../../src/types.js";
import { buildUpcomingBirthdays } from "../../src/utils/upcomingBirthdays.js";

describe("buildUpcomingBirthdays", () => {
  it("sorts birthdays by upcoming date and computes ages in the configured timezone", () => {
    const companies: CompanySnapshot[] = [
      {
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
          },
          {
            companyId: "123",
            userId: "11",
            fullName: "Casey Stone",
            month: 4,
            day: 8
          },
          {
            companyId: "123",
            userId: "12",
            fullName: "Morgan Lake",
            month: 2,
            day: 29,
            birthYear: 2000
          }
        ],
        ics: "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
      }
    ];

    const birthdays = buildUpcomingBirthdays(
      companies,
      "America/New_York",
      new Date("2026-04-08T12:00:00.000Z")
    );

    expect(birthdays).toHaveLength(3);
    expect(birthdays[0]).toMatchObject({
      fullName: "Casey Stone",
      daysUntil: 0,
      month: 4,
      day: 8,
      age: undefined
    });
    expect(birthdays[1]).toMatchObject({
      fullName: "Alex Burgess",
      daysUntil: 33,
      month: 5,
      day: 11,
      age: 34
    });
    expect(birthdays[2]).toMatchObject({
      fullName: "Morgan Lake",
      daysUntil: 326,
      month: 2,
      day: 28,
      age: 27
    });
  });
});
