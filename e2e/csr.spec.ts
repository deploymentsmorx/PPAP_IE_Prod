import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

const SEED = "seed-ppap-1170750-raw-h";

// Acceptance: the sheet's 5 zone-picture pages print as in the sheet, and
// every requirement shows its compliance status.
test("CSR: the 5 zone-picture pages print as in the sheet; all requirements show complied status", async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);

  // --- Print: definitions page + 5 zone pages laid out like the sheet ---
  await page.goto(`/ppap/${SEED}/17/print`);
  const definitions = page.getByTestId("csr-print-definitions");
  await expect(definitions).toContainText("No defect tolerated");
  await expect(definitions).toContainText("Gloss tolerance: between 80% and 90% at 60°");
  await expect(definitions).toContainText("The observer must inspect the surface from a distance of 1 metre");
  await expect(definitions).toContainText("Some defects tolerated");
  await expect(definitions).toContainText("Corrosion protection must be ensured necessarily");

  const zonePages = page.getByTestId("csr-print-zone-page");
  await expect(zonePages).toHaveCount(5);
  const expected = [
    ["Visible Area - A"],
    ["Visible Area - A", "Moderate Visible Area - B"],
    ["Visible Area - A"],
    ["Visible Area - A", "Moderately Visible Area - B"],
    ["Moderately Visible Area - B"],
  ];
  for (const [i, captions] of expected.entries()) {
    const zp = zonePages.nth(i);
    await expect(zp).toContainText("CSR - CUSTOMER SPECIFIC REQUIREMENTS"); // header repeated on every page
    await expect(zp.getByTestId("csr-print-view")).toHaveCount(captions.length);
    await expect(zp.locator("figcaption")).toHaveText(captions);
  }
  // Every picture actually loaded.
  const loaded = await page.locator('[data-testid="csr-print-view"] img').evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0));
  expect(loaded).toEqual([true, true, true, true, true, true, true]);

  // --- Compliance: every requirement has a status ---
  const printRows = page.getByTestId("csr-compliance-table").locator("tbody tr");
  await expect(printRows).toHaveCount(11);
  for (const text of await printRows.locator("td:nth-child(3)").allInnerTexts()) {
    expect(["Y", "N", "Not assessed"]).toContain(text.trim());
  }

  await page.goto(`/ppap/${SEED}/17`);
  const rows = page.getByTestId("csr-requirement");
  await expect(rows).toHaveCount(11);
  for (let i = 0; i < 11; i++) {
    await expect(rows.nth(i)).toContainText(/Complied|Not complied|Not assessed/);
  }
  await expect(page.getByTestId("csr-summary")).toContainText("of 11 complied");

  // --- Zone criteria API (for AAR) ---
  const libraryHref = await page.locator('a[href^="/csr?customer="]').getAttribute("href");
  const customerId = new URLSearchParams(libraryHref!.split("?")[1]).get("customer");
  const api = await page.request.get(`/api/csr/${customerId}/zones`);
  expect(api.status()).toBe(200);
  const body = await api.json();
  expect(body.zones.map((z: { code: string }) => z.code)).toEqual(["A", "B", "C"]);
  expect(body.zones[0].criteria.gloss).toMatchObject({ minPct: 80, maxPct: 90, angleDeg: 60 });
  expect(body.zones[0].criteria.minDftUm.value).toBe(120);
});

test("CSR: library per customer feeds AAR; compliance; zone map drawn and saved", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E CSR Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E CSR Test Part");
  await page.getByLabel("Part number").fill("E2E-CSR-001");
  await page.getByLabel("Revision letter").fill("A");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  // --- Library for the new customer: zone A with a gloss rule ---
  await page.goto("/csr");
  await page.getByRole("link", { name: "E2E CSR Test Customer" }).click();
  await page.locator("#sec-new-code").fill("A");
  await page.locator("#sec-new-title").fill("Zone A");
  await page.locator("#sec-new-description").fill("No defect tolerated");
  await page.getByRole("button", { name: "Add section" }).click();
  const section = page.getByTestId("csr-library-A");
  await expect(section).toBeVisible({ timeout: 20_000 });
  await section.getByLabel("Requirement").fill("Gloss tolerance: between 85% and 95% at 60°");
  await section.getByLabel("Used by AAR as").selectOption("GLOSS");
  await section.getByRole("button", { name: "Add", exact: true }).click();
  await expect(section.getByTestId("csr-library-requirement")).toHaveCount(1, { timeout: 20_000 });

  // --- AAR pre-fills from it ---
  await page.goto(`/ppap/${ppapId}/13`);
  await expect(page.getByLabel("Gloss Level acceptance criteria")).toHaveValue("85–95% at 60° (CSR Zone A)");

  // --- Compliance with evidence link ---
  await page.goto(`/ppap/${ppapId}/17`);
  await expect(page.getByTestId("csr-requirement")).toHaveCount(1);
  await expect(page.getByTestId("csr-requirement")).toContainText("Not assessed");
  await page.getByLabel("A1 complied").selectOption("Y");
  await page.getByLabel("A1 evidence element").selectOption("13");
  await page.getByLabel("A1 remark").fill("Gloss 88 GU measured");
  await page.getByRole("button", { name: "Save compliance" }).click();
  await expect(page.getByTestId("csr-summary")).toContainText("1 of 1 complied", { timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Open 13. Appearance Approval Report (AAR)" })).toBeVisible();

  // --- Zone map: add a page, upload a picture, draw a zone A rectangle ---
  await page.getByRole("button", { name: "+ Add zone-map page" }).click();
  await expect(page.getByTestId("zone-map-page")).toHaveCount(1, { timeout: 20_000 });
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 300 } });
  await page.setInputFiles('input[aria-label="Page 1 picture"]', { name: "front-view.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("Page 1 new picture caption").fill("Visible Area - A");
  await page.getByRole("button", { name: "Add picture" }).click();
  const view = page.getByTestId("zone-view");
  await expect(view).toHaveCount(1, { timeout: 20_000 });

  const layer = view.getByTestId("zone-draw-layer");
  // boundingBox() is in viewport coordinates — the picture must be on screen for the drag to land on it.
  await layer.scrollIntoViewIfNeeded();
  const box = (await layer.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await view.getByLabel("Zone label").fill("Front panel");
  await expect(view.getByText("A rect")).toBeVisible();
  await view.getByRole("button", { name: "Save zones" }).click();
  await expect(view.getByText("Saved.")).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByTestId("zone-view").getByTestId("zone-label")).toHaveText("A");

  // --- Print + exports ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/17/print`);
  await expect(printPage.getByTestId("csr-print-zone-page")).toHaveCount(1);
  await expect(printPage.getByTestId("csr-print-zone-page").getByTestId("zone-label")).toHaveText("A");
  await expect(printPage.getByTestId("csr-print-compliance")).toContainText("Gloss 88 GU measured");
  await printPage.close();

  const excel = await page.request.get(`/api/csr-export/${await page.locator('a[href^="/api/csr-export/"]').getAttribute("href").then((h) => h!.split("/").pop())}`);
  expect(excel.status()).toBe(200);
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK");
  const pdf = await page.request.get(`/api/ppap/${ppapId}/17/pdf`, { timeout: 60_000 });
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
