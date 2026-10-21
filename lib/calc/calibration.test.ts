import { describe, expect, it } from "vitest";
import {
  calibrationStatus,
  isInstrumentPickable,
  computeCalibrationDue,
  parseFrequencyMonths,
  formatFrequencyMonths,
  parseSheetDate,
  daysUntilDue,
  buildCalibrationDigest,
} from "./calibration";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
// Fixed "today" so these tests don't drift with the calendar.
const TODAY = utc("2026-10-17");

describe("calibrationStatus", () => {
  it("is VALID when the due date is 15 or more days out", () => {
    expect(calibrationStatus(utc("2026-11-01"), TODAY)).toBe("VALID"); // 15 days
    expect(calibrationStatus(utc("2026-11-14"), TODAY)).toBe("VALID"); // IE-SE-01, 28 days
  });

  it("is DUE_SOON inside the window, including the due day itself", () => {
    expect(calibrationStatus(utc("2026-10-31"), TODAY)).toBe("DUE_SOON"); // 14 days
    expect(calibrationStatus(utc("2026-10-17"), TODAY)).toBe("DUE_SOON"); // today
  });

  it("honours a configured window", () => {
    expect(calibrationStatus(utc("2026-11-14"), TODAY, 30)).toBe("DUE_SOON");
    expect(calibrationStatus(utc("2026-10-25"), TODAY, 5)).toBe("VALID");
  });

  it("is OVERDUE from the day after the due date, NOT_CALIBRATED with no due date", () => {
    expect(calibrationStatus(utc("2026-10-16"), TODAY)).toBe("OVERDUE");
    expect(calibrationStatus(null, TODAY)).toBe("NOT_CALIBRATED");
  });

  // Acceptance: the real "16. Checking Aids" sample as of 17-Oct-2026.
  it("marks IE-VC-01, IE-HG-02, IE-GM-01 and both magnetic V blocks OVERDUE", () => {
    expect(calibrationStatus(utc("2026-06-03"), TODAY)).toBe("OVERDUE"); // IE-VC-01
    expect(calibrationStatus(utc("2026-06-23"), TODAY)).toBe("OVERDUE"); // IE-HG-02
    expect(calibrationStatus(utc("2026-05-03"), TODAY)).toBe("OVERDUE"); // IE-GM-01
    expect(calibrationStatus(parseSheetDate("22/07/2026"), TODAY)).toBe("OVERDUE"); // magnetic V blocks (text date)
    expect(calibrationStatus(utc("2026-12-03"), TODAY)).toBe("VALID"); // IE-BP-01
  });
});

describe("isInstrumentPickable", () => {
  it("rejects OVERDUE and NOT_CALIBRATED, allows VALID and DUE_SOON", () => {
    expect(isInstrumentPickable(utc("2026-06-03"), TODAY)).toBe(false);
    expect(isInstrumentPickable(null, TODAY)).toBe(false);
    expect(isInstrumentPickable(utc("2026-10-25"), TODAY)).toBe(true);
    expect(isInstrumentPickable(utc("2026-12-03"), TODAY)).toBe(true);
  });
});

describe("computeCalibrationDue", () => {
  it("adds the frequency in months", () => {
    expect(computeCalibrationDue(utc("2025-07-22"), 12)).toEqual(utc("2026-07-22"));
    expect(computeCalibrationDue(utc("2025-11-15"), 6)).toEqual(utc("2026-05-15"));
  });

  it("clamps to the end of a shorter month", () => {
    expect(computeCalibrationDue(utc("2026-01-31"), 1)).toEqual(utc("2026-02-28"));
    expect(computeCalibrationDue(utc("2027-08-31"), 6)).toEqual(utc("2028-02-29"));
  });

  it("is null without a calibration date or frequency", () => {
    expect(computeCalibrationDue(null, 12)).toBeNull();
    expect(computeCalibrationDue(utc("2026-01-01"), null)).toBeNull();
  });
});

describe("sheet parsing", () => {
  it("reads calibration frequency text as months", () => {
    expect(parseFrequencyMonths("1 Year")).toBe(12);
    expect(parseFrequencyMonths("1 YEAR")).toBe(12);
    expect(parseFrequencyMonths("6 Months")).toBe(6);
    expect(parseFrequencyMonths("12")).toBe(12);
    expect(parseFrequencyMonths("as required")).toBeNull();
  });

  it("formats months back in the sheet's wording", () => {
    expect(formatFrequencyMonths(12)).toBe("1 Year");
    expect(formatFrequencyMonths(24)).toBe("2 Years");
    expect(formatFrequencyMonths(6)).toBe("6 Months");
    expect(formatFrequencyMonths(null)).toBe("-");
  });

  it("reads real dates, Excel serials and DD/MM/YYYY text", () => {
    expect(parseSheetDate(45812)).toEqual(utc("2025-06-04")); // IE-VC-01 calibrated on
    expect(parseSheetDate(46176)).toEqual(utc("2026-06-03")); // IE-VC-01 due
    expect(parseSheetDate("22/07/2025")).toEqual(utc("2025-07-22"));
    expect(parseSheetDate(new Date("2025-12-04T00:00:00.000Z"))).toEqual(utc("2025-12-04"));
  });

  it("treats '-', blanks and impossible dates as no date", () => {
    expect(parseSheetDate("-")).toBeNull();
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate(null)).toBeNull();
    expect(parseSheetDate("31/02/2025")).toBeNull();
  });
});

describe("buildCalibrationDigest", () => {
  it("groups overdue / not calibrated / due soon, soonest first", () => {
    const digest = buildCalibrationDigest(
      [
        { description: "GLOSSY METER", ieIdNo: "IE-GM-01", location: null, calibrationDue: utc("2026-05-03") },
        { description: "VERNIER CALIPER", ieIdNo: "IE-VC-01", location: "Instruments cuboard", calibrationDue: utc("2026-06-03") },
        { description: "SHOTBLASTING COMPARATOR", ieIdNo: "IE -SBC-01", location: null, calibrationDue: null },
        { description: "TPG", ieIdNo: "IE-TPG-99", location: null, calibrationDue: utc("2026-10-27") },
        { description: "BEVEL PROTRACTOR", ieIdNo: "IE-BP-01", location: null, calibrationDue: utc("2026-12-03") },
      ],
      TODAY,
    )!;
    expect(digest.counts).toEqual({ OVERDUE: 2, NOT_CALIBRATED: 1, DUE_SOON: 1 });
    expect(digest.subject).toBe("Calibration: 2 overdue, 1 due soon, 1 not calibrated");
    expect(digest.text.indexOf("IE-GM-01")).toBeLessThan(digest.text.indexOf("IE-VC-01"));
    expect(digest.text).toContain("IE-TPG-99 — TPG — due 27-10-2026, in 10 day(s)");
    expect(digest.text).not.toContain("IE-BP-01");
  });

  it("is null when everything is valid", () => {
    expect(buildCalibrationDigest([{ description: "X", ieIdNo: null, location: null, calibrationDue: utc("2027-01-01") }], TODAY)).toBeNull();
  });

  it("counts days from today", () => {
    expect(daysUntilDue(utc("2026-10-27"), TODAY)).toBe(10);
  });
});
