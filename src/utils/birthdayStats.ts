import { BirthdayPerson } from "../types.js";
import { normalizeBirthdayForYear } from "./date.js";

export interface BirthdayStatsBucket {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
}

export interface MostPopularBirthdayDay {
  label: string;
  count: number;
  tiedDays: number;
  tiedLabels: string[];
}

export interface BirthdayFunStats {
  referenceYear: number;
  byMonth: BirthdayStatsBucket[];
  byWeek: BirthdayStatsBucket[];
  byWeekday: BirthdayStatsBucket[];
  busiestMonth: BirthdayStatsBucket | null;
  busiestWeek: BirthdayStatsBucket | null;
  busiestWeekday: BirthdayStatsBucket | null;
  mostPopularDay: MostPopularBirthdayDay | null;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function createBuckets(labels: string[], prefix: string, longLabels?: string[]): BirthdayStatsBucket[] {
  return labels.map((label, index) => ({
    key: `${prefix}-${index + 1}`,
    label: longLabels?.[index] ?? label,
    shortLabel: label,
    count: 0
  }));
}

function buildWeekBuckets(): BirthdayStatsBucket[] {
  return Array.from({ length: 53 }, (_unused, index) => ({
    key: `week-${index + 1}`,
    label: `Week ${index + 1}`,
    shortLabel: `W${index + 1}`,
    count: 0
  }));
}

function getDayOfYear(year: number, month: number, day: number): number {
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.floor((current - start) / 86400000) + 1;
}

function getWeekOfYear(year: number, month: number, day: number): number {
  return Math.ceil(getDayOfYear(year, month, day) / 7);
}

function getWeekdayIndex(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function pickTopBucket(buckets: BirthdayStatsBucket[]): BirthdayStatsBucket | null {
  let topBucket: BirthdayStatsBucket | null = null;

  for (const bucket of buckets) {
    if (!topBucket || bucket.count > topBucket.count) {
      topBucket = bucket;
    }
  }

  return topBucket && topBucket.count > 0 ? topBucket : null;
}

function formatMonthDay(month: number, day: number): string {
  return `${MONTH_LONG_LABELS[month - 1]} ${day}`;
}

export function buildBirthdayFunStats(people: BirthdayPerson[], referenceYear: number): BirthdayFunStats {
  const byMonth = createBuckets(MONTH_LABELS, "month", MONTH_LONG_LABELS);
  const byWeek = buildWeekBuckets();
  const byWeekday = createBuckets(WEEKDAY_LABELS, "weekday", WEEKDAY_LONG_LABELS);
  const popularDayCounts = new Map<string, { month: number; day: number; count: number }>();

  for (const person of people) {
    byMonth[person.month - 1].count += 1;

    const normalized = normalizeBirthdayForYear(person.month, person.day, referenceYear);
    const weekIndex = getWeekOfYear(referenceYear, normalized.month, normalized.day) - 1;
    const weekdayIndex = getWeekdayIndex(referenceYear, normalized.month, normalized.day);

    if (byWeek[weekIndex]) {
      byWeek[weekIndex].count += 1;
    }

    byWeekday[weekdayIndex].count += 1;

    const popularKey = `${person.month.toString().padStart(2, "0")}-${person.day.toString().padStart(2, "0")}`;
    const existing = popularDayCounts.get(popularKey);
    if (existing) {
      existing.count += 1;
    } else {
      popularDayCounts.set(popularKey, {
        month: person.month,
        day: person.day,
        count: 1
      });
    }
  }

  const sortedPopularDays = Array.from(popularDayCounts.values()).sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    if (a.month !== b.month) {
      return a.month - b.month;
    }
    return a.day - b.day;
  });

  const mostPopularDay = sortedPopularDays[0]
    ? {
        label: formatMonthDay(sortedPopularDays[0].month, sortedPopularDays[0].day),
        count: sortedPopularDays[0].count,
        tiedDays: sortedPopularDays.filter((day) => day.count === sortedPopularDays[0].count).length - 1,
        tiedLabels: sortedPopularDays
          .filter(
            (day) =>
              day.count === sortedPopularDays[0].count &&
              !(day.month === sortedPopularDays[0].month && day.day === sortedPopularDays[0].day)
          )
          .map((day) => formatMonthDay(day.month, day.day))
      }
    : null;

  return {
    referenceYear,
    byMonth,
    byWeek,
    byWeekday,
    busiestMonth: pickTopBucket(byMonth),
    busiestWeek: pickTopBucket(byWeek),
    busiestWeekday: pickTopBucket(byWeekday),
    mostPopularDay
  };
}
