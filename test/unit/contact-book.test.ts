import { describe, expect, it } from "vitest";

import { mergeContactCandidates } from "../../src/utils/contactBook.js";

describe("mergeContactCandidates", () => {
  it("merges duplicate contacts by email and combines company names", () => {
    const merged = mergeContactCandidates([
      {
        companyId: "1",
        companyName: "Downtown",
        userId: "10",
        firstName: "Alex",
        lastName: "Burgess",
        fullName: "Alex Burgess",
        email: "alex@example.com",
        birthday: {
          month: 5,
          day: 11
        }
      },
      {
        companyId: "2",
        companyName: "Uptown",
        userId: "99",
        firstName: "Alex",
        lastName: "Burgess",
        fullName: "Alex Burgess",
        email: "alex@example.com",
        birthday: {
          year: 1992,
          month: 5,
          day: 11
        },
        phone: "+15551234567"
      }
    ]);

    expect(merged.warnings).toEqual([]);
    expect(merged.contacts).toHaveLength(1);
    expect(merged.contacts[0]).toMatchObject({
      firstName: "Alex",
      lastName: "Burgess",
      fullName: "Alex Burgess",
      companyName: "Downtown / Uptown",
      companyNames: ["Downtown", "Uptown"],
      email: "alex@example.com",
      phone: "+15551234567",
      birthday: {
        year: 1992,
        month: 5,
        day: 11
      }
    });
  });

  it("keeps deterministic values and logs merge warnings for conflicts", () => {
    const merged = mergeContactCandidates([
      {
        companyId: "1",
        companyName: "Downtown",
        userId: "10",
        firstName: "Alex",
        lastName: "Burgess",
        fullName: "Alex Burgess",
        email: "alex@example.com"
      },
      {
        companyId: "2",
        companyName: "Downtown",
        userId: "11",
        firstName: "Alec",
        lastName: "Burgess",
        fullName: "Alec Burgess",
        email: "alex@example.com"
      }
    ]);

    expect(merged.contacts).toHaveLength(1);
    expect(merged.contacts[0].firstName).toBe("Alex");
    expect(merged.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "firstName",
          kept: "Alex",
          ignored: "Alec"
        })
      ])
    );
  });
});
