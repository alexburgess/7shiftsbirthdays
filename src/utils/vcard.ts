import { createHash } from "node:crypto";

import { ContactBirthday, ContactRecord } from "../types.js";

export type VCardVersion = "3.0" | "4.0";

export interface BuildContactVCardOptions {
  version: VCardVersion;
  unknownBirthYearFallback?: number;
}

function escapeVCardText(value: string): string {
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

  const parts: string[] = [];
  for (let index = 0; index < line.length; index += max) {
    const chunk = line.slice(index, index + max);
    parts.push(index === 0 ? chunk : ` ${chunk}`);
  }
  return parts.join("\r\n");
}

function formatBirthday(birthday: ContactBirthday | undefined, options: BuildContactVCardOptions): string | undefined {
  if (!birthday) {
    return undefined;
  }

  const month = String(birthday.month).padStart(2, "0");
  const day = String(birthday.day).padStart(2, "0");

  if (options.version === "4.0") {
    if (birthday.year) {
      return `${birthday.year}${month}${day}`;
    }

    return `--${month}${day}`;
  }

  const year = birthday.year ?? options.unknownBirthYearFallback;
  if (!year) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

function formatRevTimestamp(value: string, version: VCardVersion): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getUTCFullYear().toString().padStart(4, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const hours = String(parsed.getUTCHours()).padStart(2, "0");
  const minutes = String(parsed.getUTCMinutes()).padStart(2, "0");
  const seconds = String(parsed.getUTCSeconds()).padStart(2, "0");

  if (version === "4.0") {
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

function formatTelephoneText(value: string): string {
  return value.trim();
}

export function buildContactVCard(contact: ContactRecord, options: BuildContactVCardOptions): string {
  const lines = [
    "BEGIN:VCARD",
    `VERSION:${options.version}`,
    foldLine(
      options.version === "4.0"
        ? `UID;VALUE=text:${escapeVCardText(contact.uid)}`
        : `UID:${escapeVCardText(contact.uid)}`
    ),
    foldLine(`FN:${escapeVCardText(contact.fullName)}`),
    foldLine(`N:${escapeVCardText(contact.lastName)};${escapeVCardText(contact.firstName)};;;`),
    foldLine(`ORG:${escapeVCardText(contact.companyName)}`)
  ];

  if (contact.email) {
    lines.push(foldLine(`EMAIL:${escapeVCardText(contact.email)}`));
  }

  if (contact.phone) {
    lines.push(foldLine(`TEL:${escapeVCardText(formatTelephoneText(contact.phone))}`));
  }

  const birthday = formatBirthday(contact.birthday, options);
  if (birthday) {
    lines.push(`BDAY:${birthday}`);
  }

  lines.push(`REV:${formatRevTimestamp(contact.rev, options.version)}`);
  lines.push("END:VCARD");

  return `${lines.join("\r\n")}\r\n`;
}

export function getVCardEtag(vcard: string): string {
  const hash = createHash("sha1").update(vcard).digest("hex");
  return `"${hash}"`;
}
