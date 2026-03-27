export interface BirthdayPerson {
  companyId: string;
  userId: string;
  fullName: string;
  month: number;
  day: number;
  birthYear?: number;
}

export interface ContactBirthday {
  month: number;
  day: number;
  year?: number;
}

export interface ContactRecord {
  uid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  companyName: string;
  companyNames: string[];
  email?: string;
  phone?: string;
  birthday?: ContactBirthday;
  photoDataUri?: string;
  rev: string;
}

export interface ContactsSnapshot {
  bookName: string;
  contacts: ContactRecord[];
}

export interface MissingBirthdayPerson {
  companyId: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface CompanySnapshot {
  companyId: string;
  companyName: string;
  people: BirthdayPerson[];
  missingBirthdayPeople?: MissingBirthdayPerson[];
  activeEmployeeCount?: number;
  fetchedUserCount?: number;
  ics: string;
}

export interface CacheSnapshot {
  lastSyncedAt: string | null;
  timezone: string;
  horizonYears: number;
  contacts?: ContactsSnapshot;
  companies: Record<string, CompanySnapshot>;
}

export interface BirthdayIndexEntry {
  companyId: string;
  companyName: string;
  icsUrl: string;
  lastSyncedAt: string | null;
}
