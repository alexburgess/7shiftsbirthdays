import { describe, expect, it } from "vitest";

import { buildCardDavPaths, buildPropfindDocument, buildReportDocument } from "../../src/utils/carddav.js";
import { ContactRecord } from "../../src/types.js";

describe("buildReportDocument", () => {
  it("matches requested hrefs even when the client percent-encodes the uid", () => {
    const paths = buildCardDavPaths("/contacts/carddav");
    const contacts: ContactRecord[] = [
      {
        uid: "contact-1@7shifts-birthday-calendar",
        firstName: "Alex",
        lastName: "Burgess",
        fullName: "Alex Burgess",
        companyName: "Downtown",
        companyNames: ["Downtown"],
        rev: "2026-03-27T12:00:00.000Z"
      }
    ];

    const report = buildReportDocument({
      paths,
      reportType: "addressbook-multiget",
      requestedHrefs: [
        "https://birthdaycalendar.me/contacts/carddav/addressbooks/employees/contact-1%407shifts-birthday-calendar.vcf"
      ],
      contacts,
      baseUrl: "https://birthdaycalendar.me",
      lastSyncedAt: "2026-03-27T12:00:00.000Z",
      vcardOptions: {
        version: "4.0"
      }
    });

    expect(report).toContain("contact-1%407shifts-birthday-calendar.vcf");
    expect(report).toContain("FN:Alex Burgess");
    expect(report).toContain('version="4.0"');
  });
});

describe("buildPropfindDocument", () => {
  it("advertises read-only privileges on the address book", () => {
    const paths = buildCardDavPaths("/contacts/carddav");
    const contacts: ContactRecord[] = [
      {
        uid: "contact-1@7shifts-birthday-calendar",
        firstName: "Alex",
        lastName: "Burgess",
        fullName: "Alex Burgess",
        companyName: "Downtown",
        companyNames: ["Downtown"],
        rev: "2026-03-27T12:00:00.000Z"
      }
    ];

    const document = buildPropfindDocument({
      paths,
      requestPath: "/contacts/carddav/addressbooks/employees/",
      depth: "0",
      baseUrl: "https://birthdaycalendar.me",
      bookName: "7shifts Staff",
      username: "admin",
      lastSyncedAt: "2026-03-27T12:00:00.000Z",
      contacts,
      vcardOptions: {
        version: "3.0",
        unknownBirthYearFallback: 1604
      }
    });

    expect(document).toContain("<D:current-user-privilege-set>");
    expect(document).toContain("<D:privilege><D:read/></D:privilege>");
    expect(document).toContain("<D:privilege><D:read-current-user-privilege-set/></D:privilege>");
    expect(document).not.toContain("<D:privilege><D:write/></D:privilege>");
    expect(document).toContain('version="3.0"');
  });
});
