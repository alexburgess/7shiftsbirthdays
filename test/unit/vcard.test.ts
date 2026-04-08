import { describe, expect, it } from "vitest";

import { buildContactVCard } from "../../src/utils/vcard.js";

describe("buildContactVCard", () => {
  const baseContact = {
    uid: "contact-1@7shifts-birthday-calendar",
    firstName: "Alex",
    lastName: "Burgess",
    fullName: "Alex Burgess",
    companyName: "Downtown",
    companyNames: ["Downtown"],
    email: "alex@example.com",
    phone: "+15551234567",
    birthday: {
      year: 1992,
      month: 5,
      day: 11
    },
    rev: "2026-03-27T12:00:00.000Z"
  } as const;

  it("renders an Apple-compatible vCard 3.0 contact", () => {
    const vcard = buildContactVCard(baseContact, {
      version: "3.0",
      unknownBirthYearFallback: 1604
    });

    expect(vcard).toContain("BEGIN:VCARD");
    expect(vcard).toContain("VERSION:3.0");
    expect(vcard).toContain("FN:Alex Burgess");
    expect(vcard).toContain("UID:contact-1@7shifts-birthday-calendar");
    expect(vcard).toContain("N:Burgess;Alex;;;");
    expect(vcard).toContain("ORG:Downtown");
    expect(vcard).toContain("EMAIL:alex@example.com");
    expect(vcard).toContain("TEL:+15551234567");
    expect(vcard).toContain("BDAY:1992-05-11");
    expect(vcard).toContain("REV:2026-03-27T12:00:00Z");
  });

  it("renders a vCard 4.0 contact for iPhone-style clients", () => {
    const vcard = buildContactVCard(baseContact, {
      version: "4.0"
    });

    expect(vcard).toContain("VERSION:4.0");
    expect(vcard).toContain("UID;VALUE=text:contact-1@7shifts-birthday-calendar");
    expect(vcard).toContain("BDAY:19920511");
    expect(vcard).toContain("REV:20260327T120000Z");
  });

  it("renders a placeholder year for yearless birthdays in the Apple-compatible profile", () => {
    const vcard = buildContactVCard({
      uid: "contact-2@7shifts-birthday-calendar",
      firstName: "No",
      lastName: "Year",
      fullName: "No Year",
      companyName: "Uptown",
      companyNames: ["Uptown"],
      birthday: {
        month: 7,
        day: 4
      },
      rev: "2026-03-27T12:00:00.000Z"
    }, {
      version: "3.0",
      unknownBirthYearFallback: 1604
    });

    expect(vcard).toContain("BDAY:1604-07-04");
    expect(vcard).not.toContain("EMAIL:");
    expect(vcard).not.toContain("TEL:");
  });

  it("renders a partial birthday in the modern 4.0 profile", () => {
    const vcard = buildContactVCard({
      uid: "contact-3@7shifts-birthday-calendar",
      firstName: "No",
      lastName: "Year",
      fullName: "No Year",
      companyName: "Uptown",
      companyNames: ["Uptown"],
      birthday: {
        month: 7,
        day: 4
      },
      rev: "2026-03-27T12:00:00.000Z"
    }, {
      version: "4.0"
    });

    expect(vcard).toContain("BDAY:--0704");
  });
});
