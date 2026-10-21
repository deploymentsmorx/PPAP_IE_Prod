import { describe, expect, it } from "vitest";
import { nextRevisionLetter } from "./revision";

describe("nextRevisionLetter", () => {
  it("increments a single letter", () => {
    expect(nextRevisionLetter("H")).toBe("I");
    expect(nextRevisionLetter("A")).toBe("B");
  });

  it("rolls Z over to AA", () => {
    expect(nextRevisionLetter("Z")).toBe("AA");
  });

  it("rolls the last letter within a multi-letter revision", () => {
    expect(nextRevisionLetter("AZ")).toBe("BA");
  });

  it("is case-insensitive on input", () => {
    expect(nextRevisionLetter("h")).toBe("I");
  });

  it("rejects non-alphabetic revisions", () => {
    expect(() => nextRevisionLetter("1")).toThrow();
  });
});
