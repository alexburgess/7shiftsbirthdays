export interface ParsedBirthDate {
  month: number;
  day: number;
  birthYear?: number;
}

export function isUnknownBirthYear(birthYear: number | undefined): boolean {
  return birthYear === 1900 || birthYear === 1910;
}

export function ordinal(value: number): string {
  const abs = Math.abs(value);
  const mod100 = abs % 100;

  if (mod100 >= 11 && mod100 <= 13) {
    return `${value}th`;
  }

  switch (abs % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function computeAge(birthYear: number, eventYear: number): number | undefined {
  if (!Number.isFinite(birthYear) || birthYear <= 0) {
    return undefined;
  }
  if (birthYear > eventYear) {
    return undefined;
  }

  return eventYear - birthYear;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function normalizeBirthdayForYear(month: number, day: number, year: number): { month: number; day: number } {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { month: 2, day: 28 };
  }
  return { month, day };
}

export function formatDateForIcs(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}${month.toString().padStart(2, "0")}${day
    .toString()
    .padStart(2, "0")}`;
}

function isValidMonthDay(month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12) {
    return false;
  }

  if (day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(2024, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toInt(value: string): number {
  return Number.parseInt(value, 10);
}

export function parseBirthDate(value: unknown): ParsedBirthDate | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const yyyyMmDd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyyMmDd) {
    const birthYear = toInt(yyyyMmDd[1]);
    const month = toInt(yyyyMmDd[2]);
    const day = toInt(yyyyMmDd[3]);

    if (!isValidMonthDay(month, day)) {
      return null;
    }

    return { month, day, birthYear };
  }

  const mmDd = raw.match(/^(\d{2})-(\d{2})$/);
  if (mmDd) {
    const month = toInt(mmDd[1]);
    const day = toInt(mmDd[2]);

    if (!isValidMonthDay(month, day)) {
      return null;
    }

    return { month, day };
  }

  const slashWithYear = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashWithYear) {
    const month = toInt(slashWithYear[1]);
    const day = toInt(slashWithYear[2]);
    const birthYear = toInt(slashWithYear[3]);

    if (!isValidMonthDay(month, day)) {
      return null;
    }

    return { month, day, birthYear };
  }

  const slashNoYear = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashNoYear) {
    const month = toInt(slashNoYear[1]);
    const day = toInt(slashNoYear[2]);

    if (!isValidMonthDay(month, day)) {
      return null;
    }

    return { month, day };
  }

  return null;
}
