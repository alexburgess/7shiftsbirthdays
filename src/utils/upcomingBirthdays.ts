import { CompanySnapshot } from "../types.js";
import { computeAge, normalizeBirthdayForYear } from "./date.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const EMOJIS = ["🎂", "🍰", "🧁", "🎉", "🎈", "🥳", "🎊"] as const;

export interface UpcomingBirthday {
  companyId: string;
  companyName: string;
  userId: string;
  fullName: string;
  month: number;
  day: number;
  birthYear?: number;
  nextBirthday: string;
  daysUntil: number;
  age?: number;
  emoji: string;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function getDatePartsInTimezone(value: Date, timezone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(value);
  const year = Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "", 10);
  const month = Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "", 10);
  const day = Number.parseInt(parts.find((part) => part.type === "day")?.value ?? "", 10);

  return { year, month, day };
}

function toDateKey(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function selectEmoji(input: { fullName: string; userId: string; month: number; day: number }): string {
  const seed = `${input.fullName}:${input.userId}:${input.month}:${input.day}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return EMOJIS[hash % EMOJIS.length];
}

export function buildUpcomingBirthdays(
  companies: CompanySnapshot[],
  timezone: string,
  now: Date = new Date()
): UpcomingBirthday[] {
  const today = getDatePartsInTimezone(now, timezone);
  const todayKey = toDateKey(today.year, today.month, today.day);

  return companies
    .flatMap((company) =>
      company.people.map((person) => {
        let nextBirthdayYear = today.year;
        let nextBirthdayDate = normalizeBirthdayForYear(person.month, person.day, nextBirthdayYear);

        if (toDateKey(nextBirthdayYear, nextBirthdayDate.month, nextBirthdayDate.day) < todayKey) {
          nextBirthdayYear += 1;
          nextBirthdayDate = normalizeBirthdayForYear(person.month, person.day, nextBirthdayYear);
        }

        const nextBirthdayKey = toDateKey(nextBirthdayYear, nextBirthdayDate.month, nextBirthdayDate.day);
        const age = person.birthYear === undefined ? undefined : computeAge(person.birthYear, nextBirthdayYear);

        return {
          companyId: company.companyId,
          companyName: company.companyName,
          userId: person.userId,
          fullName: person.fullName,
          month: nextBirthdayDate.month,
          day: nextBirthdayDate.day,
          birthYear: person.birthYear,
          nextBirthday: formatIsoDate(nextBirthdayYear, nextBirthdayDate.month, nextBirthdayDate.day),
          daysUntil: Math.round((nextBirthdayKey - todayKey) / DAY_IN_MS),
          age,
          emoji: selectEmoji(person)
        };
      })
    )
    .sort((left, right) => {
      if (left.daysUntil !== right.daysUntil) {
        return left.daysUntil - right.daysUntil;
      }

      const nextBirthdayCompare = left.nextBirthday.localeCompare(right.nextBirthday);
      if (nextBirthdayCompare !== 0) {
        return nextBirthdayCompare;
      }

      const nameCompare = left.fullName.localeCompare(right.fullName, undefined, { sensitivity: "base" });
      if (nameCompare !== 0) {
        return nameCompare;
      }

      return left.companyName.localeCompare(right.companyName, undefined, { sensitivity: "base" });
    });
}
