import { describe, expect, it } from "vitest";
import { completionText, specialProcesses, summarizeLabStatuses, pickKeyDimensionalRows, grrStatusText, sampleTagPayload } from "./spp";

describe("completionText", () => {
  it("is Completed once approved / submitted / customer approved", () => {
    expect(completionText("APPROVED", "REQUIRED")).toBe("Completed");
    expect(completionText("CUSTOMER_APPROVED", "RETAIN")).toBe("Completed");
  });

  it("is Pending with the current stage otherwise, and N/A for N/A pages", () => {
    expect(completionText("IN_PROGRESS", "REQUIRED")).toBe("Pending (in progress)");
    expect(completionText("NOT_STARTED", "REQUIRED")).toBe("Pending (not started)");
    expect(completionText("APPROVED", "NA")).toBe("N/A");
  });
});

describe("specialProcesses", () => {
  it("picks welding / coating / blasting from the seeded NBL operation names", () => {
    const steps = ["Material Receipt", "Plasma cutting", "Tack welding", "Welding", "Grinding/Dressing", "Shot blasting", "Painting", "Inspection", "Packing"];
    expect(specialProcesses(steps)).toEqual(["Tack welding", "Welding", "Shot blasting", "Painting"]);
  });

  it("recognises heat treatment wording", () => {
    expect(specialProcesses(["Heat treatment", "Heat-treat", "Induction hardening"])).toHaveLength(3);
  });
});

describe("summarizeLabStatuses", () => {
  it("lists NG items by name", () => {
    expect(
      summarizeLabStatuses([
        { label: "C", status: "OK" },
        { label: "Mn", status: "NG" },
      ]),
    ).toBe("1 NG (Mn)");
  });

  it("says Verified when everything judged is OK, and Not yet tested when nothing is", () => {
    expect(summarizeLabStatuses([{ label: "C", status: "OK" }, { label: "Cr", status: "UNKNOWN" }])).toBe("Verified — 1 OK");
    expect(summarizeLabStatuses([{ label: "C", status: "UNKNOWN" }])).toBe("Not yet tested");
    expect(summarizeLabStatuses([])).toBe("Not yet tested");
  });
});

describe("pickKeyDimensionalRows", () => {
  it("orders NG, then OK, then unmeasured rows, and caps the list", () => {
    const rows = [
      { slNo: "1", status: "OK" as const },
      { slNo: "2", status: "UNKNOWN" as const },
      { slNo: "3", status: "NG" as const },
      { slNo: "4", status: "OK" as const },
    ];
    expect(pickKeyDimensionalRows(rows).map((r) => r.slNo)).toEqual(["3", "1", "4", "2"]);
    expect(pickKeyDimensionalRows(rows, 2).map((r) => r.slNo)).toEqual(["3", "1"]);
  });

  it("still lists dimensions when nothing has been measured yet", () => {
    const rows = [{ slNo: "1", status: "UNKNOWN" as const }];
    expect(pickKeyDimensionalRows(rows).map((r) => r.slNo)).toEqual(["1"]);
  });
});

describe("grrStatusText", () => {
  it("formats a computed study, an incomplete one, and none", () => {
    expect(grrStatusText({ pctGrr: 8.234, verdict: "ACCEPTABLE" })).toBe("8.2% — Acceptable");
    expect(grrStatusText("INCOMPLETE")).toBe("Study incomplete");
    expect(grrStatusText(null)).toBe("No MSA study");
  });
});

describe("sampleTagPayload", () => {
  it("encodes sample ID, part, rev and date on separate lines", () => {
    expect(sampleTagPayload({ sampleId: "NBL-01", partNumber: "1170750-RAW", revision: "H", date: "16-09-2025" })).toBe(
      "Sample: NBL-01\nPart: 1170750-RAW\nRev: H\nDate: 16-09-2025",
    );
  });
});
