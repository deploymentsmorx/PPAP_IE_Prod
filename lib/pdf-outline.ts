import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef } from "pdf-lib";

export type OutlineItem = { title: string; pageIndex: number; children?: { title: string; pageIndex: number }[] };

/**
 * Writes PDF bookmarks (the document outline, PDF 1.7 §12.3.3) — pdf-lib
 * has no high-level API for it. Top-level items open; children collapsed
 * under their element. Each entry jumps to its page, fit to window.
 */
export function addOutline(doc: PDFDocument, items: OutlineItem[]) {
  if (items.length === 0) return;
  const ctx = doc.context;
  const pages = doc.getPages();
  const dest = (pageIndex: number) => ctx.obj([pages[Math.min(pageIndex, pages.length - 1)].ref, PDFName.of("Fit")]);

  const outlinesRef = ctx.nextRef();
  const itemRefs = items.map(() => ctx.nextRef());

  items.forEach((item, i) => {
    const children = item.children ?? [];
    const childRefs = children.map(() => ctx.nextRef());
    children.forEach((c, j) => {
      ctx.assign(
        childRefs[j],
        ctx.obj({
          Title: PDFHexString.fromText(c.title),
          Parent: itemRefs[i],
          ...(j > 0 ? { Prev: childRefs[j - 1] } : {}),
          ...(j < children.length - 1 ? { Next: childRefs[j + 1] } : {}),
          Dest: dest(c.pageIndex),
        }),
      );
    });
    const entry: Record<string, PDFRef | PDFHexString | ReturnType<typeof ctx.obj> | number> = {
      Title: PDFHexString.fromText(item.title),
      Parent: outlinesRef,
      Dest: dest(item.pageIndex),
    };
    if (i > 0) entry.Prev = itemRefs[i - 1];
    if (i < items.length - 1) entry.Next = itemRefs[i + 1];
    if (childRefs.length) {
      entry.First = childRefs[0];
      entry.Last = childRefs[childRefs.length - 1];
      entry.Count = -childRefs.length; // negative = collapsed
    }
    ctx.assign(itemRefs[i], ctx.obj(entry));
  });

  // Count = visible top-level entries (children start collapsed).
  ctx.assign(outlinesRef, ctx.obj({ Type: "Outlines", First: itemRefs[0], Last: itemRefs[itemRefs.length - 1], Count: items.length }));
  doc.catalog.set(PDFName.of("Outlines"), outlinesRef);
  doc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

/** Reads back the top-level bookmark titles (for tests and the pack page). */
export function readOutlineTitles(doc: PDFDocument): string[] {
  const outlines = doc.catalog.lookupMaybe(PDFName.of("Outlines"), PDFDict);
  if (!outlines) return [];
  const titles: string[] = [];
  let item = outlines.lookupMaybe(PDFName.of("First"), PDFDict);
  while (item) {
    const title = item.lookup(PDFName.of("Title"));
    titles.push(title instanceof PDFHexString ? title.decodeText() : String(title));
    item = item.lookupMaybe(PDFName.of("Next"), PDFDict);
  }
  return titles;
}
