import { createHash } from "node:crypto";

import { ContactBirthday } from "../types.js";

export interface ContactCandidate {
  companyId: string;
  companyName: string;
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  birthday?: ContactBirthday;
  photoUrl?: string;
}

export interface MergedContactCandidate {
  uid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  companyName: string;
  companyNames: string[];
  email?: string;
  phone?: string;
  birthday?: ContactBirthday;
  photoUrls: string[];
}

export interface ContactMergeWarning {
  uid: string;
  field: "firstName" | "lastName" | "fullName" | "email" | "phone" | "birthday";
  kept: string;
  ignored: string;
}

function normalizeEmail(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function normalizePhone(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/[^\d+]/g, "");
  return normalized || undefined;
}

function toMergeKey(candidate: ContactCandidate): string {
  const email = normalizeEmail(candidate.email);
  if (email) {
    return `email:${email}`;
  }

  const phone = normalizePhone(candidate.phone);
  if (phone) {
    return `phone:${phone}`;
  }

  return `record:${candidate.companyId}:${candidate.userId}`;
}

function buildContactUid(key: string): string {
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 24);
  return `contact-${hash}@7shifts-birthday-calendar`;
}

function compareCandidates(a: ContactCandidate, b: ContactCandidate): number {
  const mergeKeyCompare = toMergeKey(a).localeCompare(toMergeKey(b));
  if (mergeKeyCompare !== 0) {
    return mergeKeyCompare;
  }

  const companyCompare = a.companyName.localeCompare(b.companyName, undefined, { sensitivity: "base" });
  if (companyCompare !== 0) {
    return companyCompare;
  }

  return a.userId.localeCompare(b.userId, undefined, { sensitivity: "base" });
}

function choosePreferredString(
  current: string | undefined,
  incoming: string | undefined,
  field: ContactMergeWarning["field"],
  uid: string,
  warnings: ContactMergeWarning[]
): string | undefined {
  if (!current) {
    return incoming;
  }

  if (!incoming || current === incoming) {
    return current;
  }

  warnings.push({
    uid,
    field,
    kept: current,
    ignored: incoming
  });
  return current;
}

function isMoreCompleteBirthday(current: ContactBirthday | undefined, incoming: ContactBirthday | undefined): boolean {
  if (!incoming) {
    return false;
  }

  if (!current) {
    return true;
  }

  if (incoming.year && !current.year) {
    return true;
  }

  return false;
}

function formatBirthdayValue(value: ContactBirthday | undefined): string {
  if (!value) {
    return "";
  }

  if (value.year) {
    return `${value.year}-${value.month}-${value.day}`;
  }

  return `${value.month}-${value.day}`;
}

export function mergeContactCandidates(candidates: ContactCandidate[]): {
  contacts: MergedContactCandidate[];
  warnings: ContactMergeWarning[];
} {
  const warnings: ContactMergeWarning[] = [];
  const grouped = new Map<string, MergedContactCandidate>();

  for (const candidate of [...candidates].sort(compareCandidates)) {
    const mergeKey = toMergeKey(candidate);
    const uid = buildContactUid(mergeKey);
    const existing = grouped.get(mergeKey);

    if (!existing) {
      const companyNames = [candidate.companyName].filter(Boolean);
      grouped.set(mergeKey, {
        uid,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        fullName: candidate.fullName,
        companyName: companyNames.join(" / "),
        companyNames,
        email: candidate.email,
        phone: candidate.phone,
        birthday: candidate.birthday,
        photoUrls: candidate.photoUrl ? [candidate.photoUrl] : []
      });
      continue;
    }

    existing.firstName = choosePreferredString(existing.firstName, candidate.firstName, "firstName", uid, warnings) || "";
    existing.lastName = choosePreferredString(existing.lastName, candidate.lastName, "lastName", uid, warnings) || "";
    existing.fullName =
      choosePreferredString(existing.fullName, candidate.fullName, "fullName", uid, warnings) ||
      [existing.firstName, existing.lastName].filter(Boolean).join(" ").trim();
    existing.email = choosePreferredString(existing.email, candidate.email, "email", uid, warnings);
    existing.phone = choosePreferredString(existing.phone, candidate.phone, "phone", uid, warnings);

    if (isMoreCompleteBirthday(existing.birthday, candidate.birthday)) {
      existing.birthday = candidate.birthday;
    } else if (
      existing.birthday &&
      candidate.birthday &&
      formatBirthdayValue(existing.birthday) !== formatBirthdayValue(candidate.birthday)
    ) {
      warnings.push({
        uid,
        field: "birthday",
        kept: formatBirthdayValue(existing.birthday),
        ignored: formatBirthdayValue(candidate.birthday)
      });
    } else if (!existing.birthday && candidate.birthday) {
      existing.birthday = candidate.birthday;
    }

    if (candidate.companyName && !existing.companyNames.includes(candidate.companyName)) {
      existing.companyNames.push(candidate.companyName);
      existing.companyNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      existing.companyName = existing.companyNames.join(" / ");
    }

    if (candidate.photoUrl && !existing.photoUrls.includes(candidate.photoUrl)) {
      existing.photoUrls.push(candidate.photoUrl);
    }
  }

  return {
    contacts: Array.from(grouped.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" })
    ),
    warnings
  };
}
