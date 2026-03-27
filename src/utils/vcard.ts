import { createHash } from "node:crypto";

import { ContactBirthday, ContactRecord } from "../types.js";

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

function formatBirthday(birthday: ContactBirthday | undefined): string | undefined {
  if (!birthday) {
    return undefined;
  }

  const month = String(birthday.month).padStart(2, "0");
  const day = String(birthday.day).padStart(2, "0");

  if (birthday.year) {
    return `${birthday.year}${month}${day}`;
  }

  return `--${month}${day}`;
}

function formatRevTimestamp(value: string): string {
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

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function formatTelephoneText(value: string): string {
  return value.trim();
}

export function buildContactVCard(contact: ContactRecord): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    foldLine(`UID;VALUE=text:${escapeVCardText(contact.uid)}`),
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

  const birthday = formatBirthday(contact.birthday);
  if (birthday) {
    lines.push(`BDAY:${birthday}`);
  }

  lines.push(`REV:${formatRevTimestamp(contact.rev)}`);
  lines.push("END:VCARD");

  return `${lines.join("\r\n")}\r\n`;
}

export function getVCardEtag(vcard: string): string {
  const hash = createHash("sha1").update(vcard).digest("hex");
  return `"${hash}"`;
}
