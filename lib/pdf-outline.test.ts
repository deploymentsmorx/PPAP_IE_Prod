import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addOutline, readOutlineTitles } from "./pdf-outline";

describe("addOutline", () => {
  it("writes bookmarks that survive a save / reload, in order", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 4; i++) doc.addPage();
    addOutline(doc, [
      { title: "0. PPAP Checklist", pageIndex: 0 },
      { title: "1. Design Records", pageIndex: 1, children: [{ title: "Drawing 1170750 Rev H.pdf", pageIndex: 2 }] },
      { title: "18. Part Submission Warrant (PSW)", pageIndex: 3 },
    ]);
    const reloaded = await PDFDocument.load(await doc.save());
    expect(readOutlineTitles(reloaded)).toEqual(["0. PPAP Checklist", "1. Design Records", "18. Part Submission Warrant (PSW)"]);
  });

  it("does nothing for an empty outline", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    addOutline(doc, []);
    expect(readOutlineTitles(await PDFDocument.load(await doc.save()))).toEqual([]);
  });
});
