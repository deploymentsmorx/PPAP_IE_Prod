import { describe, expect, it } from "vitest";
import {
  masterSampleExpiry,
  expiryState,
  daysUntil,
  parseRetentionYears,
  parseMasterSampleStatus,
  nextMasterSampleId,
  masterSampleTagPayload,
} from "./master-sample";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("masterSampleExpiry", () => {
  // Acceptance: the reference sheet's NBL-001 — approved 04-10-2026 (Excel
  // serial 46299), retention 3Years — expires 04-10-2029.
  it("is approval date + retention years (NBL-001: 04-10-2026 + 3 → 04-10-2029)", () => {
    expect(masterSampleExpiry(utc("2026-10-04"), 3)).toEqual(utc("2029-10-04"));
  });

  it("clamps a 29-Feb approval to 28-Feb in a non-leap year", () => {
    expect(masterSampleExpiry(utc("2028-02-29"), 1)).toEqual(utc("2029-02-28"));
    expect(masterSampleExpiry(utc("2028-02-29"), 4)).toEqual(utc("2032-02-29"));
  });

  it("is null without an approval date or retention period", () => {
    expect(masterSampleExpiry(null, 3)).toBeNull();
    expect(masterSampleExpiry(utc("2026-10-04"), null)).toBeNull();
  });
});

describe("expiryState (30-day reminder)", () => {
  const expiry = utc("2029-10-04");

  it("is OK more than 30 days out", () => {
    expect(expiryState(expiry, utc("2029-09-03"))).toBe("OK");
  });

  it("starts reminding exactly 30 days ahead, through the expiry day", () => {
    expect(daysUntil(expiry, utc("2029-09-04"))).toBe(30);
    expect(expiryState(expiry, utc("2029-09-04"))).toBe("EXPIRING_SOON");
    expect(expiryState(expiry, utc("2029-10-04"))).toBe("EXPIRING_SOON");
  });

  it("is EXPIRED the day after, and null with no expiry", () => {
    expect(expiryState(expiry, utc("2029-10-05"))).toBe("EXPIRED");
    expect(expiryState(null)).toBeNull();
  });
});

describe("sheet cell parsing", () => {
  it("reads the retention period", () => {
    expect(parseRetentionYears("3Years")).toBe(3);
    expect(parseRetentionYears("5 years")).toBe(5);
    expect(parseRetentionYears("2 Yrs")).toBe(2);
    expect(parseRetentionYears(4)).toBe(4);
    expect(parseRetentionYears("until EOP")).toBeNull();
    expect(parseRetentionYears(null)).toBeNull();
  });

  it("reads the status, defaulting to ACTIVE", () => {
    expect(parseMasterSampleStatus("Active")).toBe("ACTIVE");
    expect(parseMasterSampleStatus("Superseded")).toBe("SUPERSEDED");
    expect(parseMasterSampleStatus("Disposed")).toBe("DISPOSED");
    expect(parseMasterSampleStatus("")).toBe("ACTIVE");
  });
});

describe("nextMasterSampleId / masterSampleTagPayload", () => {
  it("numbers like the sheet's NBL-001, skipping taken IDs", () => {
    expect(nextMasterSampleId("NBL", [])).toBe("NBL-001");
    expect(nextMasterSampleId("NBL", ["NBL-001", "NBL-003"])).toBe("NBL-002");
  });

  it("encodes the tag fields line by line", () => {
    expect(
      masterSampleTagPayload({ sampleId: "NBL-001", partNumber: "1170750-RAW", revision: "H", approvalDate: "04-10-2026", expiry: "04-10-2029", location: "Prod. Area" }),
    ).toBe("Master sample: NBL-001\nPart: 1170750-RAW\nRev: H\nApproved: 04-10-2026\nExpiry: 04-10-2029\nLocation: Prod. Area");
  });
});
