import { BirthdayPerson } from "../types.js";
import { computeAge, formatDateForIcs, isUnknownBirthYear, normalizeBirthdayForYear, ordinal } from "./date.js";

interface BuildIcsOptions {
  horizonYears: number;
  timezone: string;
  now?: Date;
}

interface BirthdayEvent {
  uid: string;
  dtStart: string;
  dtEnd: string;
  summary: string;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  const max = 73;
  if (line.length <= max) {
    return line;
  }

  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += max) {
    const slice = line.slice(i, i + max);
    if (i === 0) {
      chunks.push(slice);
    } else {
      chunks.push(` ${slice}`);
    }
  }

  return chunks.join("\r\n");
}

function addDays(year: number, month: number, day: number, amount: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

export function buildBirthdaySummary(fullName: string, birthYear: number | undefined, eventYear: number): string {
  if (birthYear !== undefined && !isUnknownBirthYear(birthYear)) {
    const age = computeAge(birthYear, eventYear);
    if (age !== undefined) {
      return `${fullName}'s ${ordinal(age)} Birthday`;
    }
  }

  return `${fullName}'s Birthday`;
}

function buildEvents(people: BirthdayPerson[], currentYear: number, horizonYears: number): BirthdayEvent[] {
  const events: BirthdayEvent[] = [];

  for (const person of people) {
    for (let year = currentYear; year <= currentYear + horizonYears; year += 1) {
      const normalizedDate = normalizeBirthdayForYear(person.month, person.day, year);
      const nextDay = addDays(year, normalizedDate.month, normalizedDate.day, 1);

      events.push({
        uid: `birthday-${person.companyId}-${person.userId}-${year}@7shifts-birthday-calendar`,
        dtStart: formatDateForIcs(year, normalizedDate.month, normalizedDate.day),
        dtEnd: formatDateForIcs(nextDay.year, nextDay.month, nextDay.day),
        summary: buildBirthdaySummary(person.fullName, person.birthYear, year)
      });
    }
  }

  return events.sort((a, b) => {
    const dateCompare = a.dtStart.localeCompare(b.dtStart);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return a.uid.localeCompare(b.uid);
  });
}

export function buildBirthdayCalendarIcs(
  companyName: string,
  people: BirthdayPerson[],
  options: BuildIcsOptions
): string {
  const now = options.now || new Date();
  const nowStamp = formatDateForIcs(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate()
  ) +
    "T" +
    now.getUTCHours().toString().padStart(2, "0") +
    now.getUTCMinutes().toString().padStart(2, "0") +
    now.getUTCSeconds().toString().padStart(2, "0") +
    "Z";

  const currentYear = Number.parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: options.timezone,
      year: "numeric"
    }).format(now),
    10
  );

  const events = buildEvents(people, currentYear, options.horizonYears);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//7shifts Birthday Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeIcsText(`${companyName} Birthdays`)}`),
    foldLine(`X-WR-TIMEZONE:${escapeIcsText(options.timezone)}`)
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${escapeIcsText(event.uid)}`));
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${event.dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${event.dtEnd}`);
    lines.push(foldLine(`SUMMARY:${escapeIcsText(event.summary)}`));
    lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
