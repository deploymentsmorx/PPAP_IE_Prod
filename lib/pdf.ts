import { chromium } from "playwright";

/**
 * Renders app print routes to PDF in headless Chromium. The caller's
 * cookie header is forwarded so the print route's auth check sees the same
 * session that requested the PDF. A @page size in the print route's CSS
 * wins over `landscape` (preferCSSPageSize).
 */
export async function renderPrintRouteToPdf(url: string, opts: { cookie: string | null; landscape: boolean }): Promise<Buffer> {
  const [pdf] = await renderPrintRoutesToPdfs([{ url, landscape: opts.landscape }], opts.cookie);
  return pdf;
}

/** Several print routes in one browser session (the PPAP pack renders up to 19). */
export async function renderPrintRoutesToPdfs(routes: { url: string; landscape: boolean }[], cookie: string | null): Promise<Buffer[]> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ extraHTTPHeaders: cookie ? { cookie } : {} });
    const page = await context.newPage();
    const out: Buffer[] = [];
    for (const r of routes) {
      // Print routes are server-rendered; "load" also waits for logo images.
      const response = await page.goto(r.url, { waitUntil: "load", timeout: 120_000 });
      if (!response || !response.ok() || new URL(page.url()).pathname === "/login") {
        throw new Error(`Print route did not render (${response?.status() ?? "no response"} at ${page.url()}).`);
      }
      out.push(await page.pdf({ format: "A4", landscape: r.landscape, printBackground: true, preferCSSPageSize: true }));
    }
    return out;
  } finally {
    await browser.close();
  }
}
