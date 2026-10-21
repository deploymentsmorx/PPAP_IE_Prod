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

async function createPpap(page: Page, name: string) {
  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill(`E2E ${name} Customer`);
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill(`E2E ${name} Part`);
  await page.getByLabel("Part number").fill(`E2E-${name.toUpperCase()}-001`);
  await page.getByLabel("Revision letter").fill("A");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  return new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Acceptance (as of the real calendar date — the sample's due dates are
// all far enough from today that this holds until the next calibrations
// are recorded).
test("Checking Aids: the imported sample shows the five overdue instruments; pickers reject overdue ones", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);

  await page.goto("/instruments");
  const statusOf = (testId: string) => page.getByTestId(testId).locator("[data-status]");
  for (const id of ["instrument-IE-VC-01", "instrument-IE-HG-02", "instrument-IE-GM-01", "instrument-23", "instrument-24"]) {
    await expect(statusOf(id)).toHaveAttribute("data-status", "OVERDUE");
  }
  await expect(page.getByTestId("instrument-23")).toContainText("MAGNETIC V BLOCK");
  await expect(page.getByTestId("instrument-24")).toContainText("MAGNETIC V BLOCK");
  await expect(page.getByTestId("instrument-23")).toContainText("22-07-2026"); // parsed from the text date "22/07/2026"
  await expect(statusOf("instrument-IE -SBC-01")).toHaveAttribute("data-status", "NOT_CALIBRATED");
  await expect(statusOf("instrument-IE-BP-01")).toHaveAttribute("data-status", "VALID");

  // Dashboard widget lists them too.
  await page.goto("/");
  await expect(page.getByTestId("calibration-widget")).toContainText("IE-GM-01");

  // --- Pickers: overdue instruments can't be chosen ---
  const ppapId = await createPpap(page, "CAPICK");
  await page.goto(`/ppap/${ppapId}/7`);
  await page.getByRole("button", { name: "+ Add row" }).click();
  const cpPicker = page.getByLabel("Instrument").first();
  await expect(cpPicker.locator("option", { hasText: "GLOSSY METER" })).toHaveAttribute("disabled", "");
  await expect(cpPicker.locator("option", { hasText: "VERNIER CALIPER" }).first()).toHaveAttribute("disabled", "");
  await expect(cpPicker.locator("option", { hasText: "BEVEL PROTRACTOR" })).not.toHaveAttribute("disabled", "");

  await page.goto(`/ppap/${ppapId}/8`);
  await page.getByRole("button", { name: "+ Add Study" }).click();
  const gauge = page.getByLabel("Gauge (Instrument)");
  await expect(gauge.locator("option", { hasText: "DIGITAL HIGHT GAUGE" })).toHaveAttribute("disabled", "");
  await expect(gauge.locator("option", { hasText: "SHOTBLASTING COMPARATOR" })).toHaveAttribute("disabled", "");
});

test("Checking Aids: instrument lifecycle, fixture register, element 16 per PPAP", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  const ppapId = await createPpap(page, "CA");

  // --- Add an instrument due in 5 days → DUE_SOON ---
  const now = new Date();
  const calibratedOn = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 5));
  await page.goto("/instruments");
  await page.locator("#inst-new-description").fill("E2E Test Micrometer");
  await page.locator("#inst-new-ieIdNo").fill("E2E-MM-01");
  await page.locator("#inst-new-range").fill("0-25mm");
  await page.locator("#inst-new-calibratedOn").fill(iso(calibratedOn));
  await page.locator("#inst-new-calibrationFrequencyMonths").fill("12");
  await page.getByRole("button", { name: "Add instrument" }).click();
  const row = page.getByTestId("instrument-E2E-MM-01");
  await expect(row.locator("[data-status]")).toHaveAttribute("data-status", "DUE_SOON", { timeout: 20_000 });

  // --- Record a new calibration → VALID, due = today + 12 months ---
  await row.getByRole("button", { name: /History/ }).click();
  await page.locator('input[name="calibratedOn"][type="date"][required]').fill(iso(now));
  await page.locator('input[name="agency"]').fill("E2E Calibration Labs");
  await page.locator('input[name="certificateNo"]').fill("CERT-E2E-1");
  await page.setInputFiles('input[name="certificate"]', { name: "cert.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await page.getByRole("button", { name: "Record calibration" }).click();
  await expect(row.locator("[data-status]")).toHaveAttribute("data-status", "VALID", { timeout: 20_000 });
  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));
  const india = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  await expect(row).toContainText(india(nextYear));
  await expect(page.getByText("E2E Calibration Labs")).toBeVisible();

  // --- Fixture linked to the part ---
  await page.locator("#fx-new-code").fill("E2E-CF-01");
  await page.locator("#fx-new-description").fill("E2E checking fixture for frame holes");
  await page.locator("#fx-new-partId").selectOption({ label: "E2E CA Part (E2E-CA-001)" });
  await page.getByRole("button", { name: "Add fixture" }).click();
  await expect(page.getByRole("cell", { name: "E2E-CF-01" })).toBeVisible({ timeout: 20_000 });

  // --- Element 16: fixture auto-listed, instrument added manually ---
  await page.goto(`/ppap/${ppapId}/16`);
  await expect(page.getByRole("cell", { name: "E2E-CF-01" })).toBeVisible();
  await expect(page.getByText("Linked to part")).toBeVisible();
  await page.getByLabel("Add instrument or fixture").selectOption({ label: "E2E-MM-01 — E2E Test Micrometer (0-25mm)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const aid = page.getByTestId("aid-E2E-MM-01");
  await expect(aid).toContainText("Added manually");
  await expect(aid.locator("[data-status]")).toHaveAttribute("data-status", "VALID");

  // --- Auto-collection: a Control Plan row using an instrument lists it ---
  await page.goto(`/ppap/${ppapId}/7`);
  await page.getByRole("button", { name: "+ Add row" }).click();
  const cpInstrument = page.getByLabel("Instrument").first();
  await cpInstrument.focus();
  await cpInstrument.selectOption({ label: "BEVEL PROTRACTOR" });
  await cpInstrument.blur(); // the grid saves a row on blur
  await expect(async () => {
    await page.goto(`/ppap/${ppapId}/16`);
    await expect(page.getByTestId("aid-IE-BP-01")).toContainText("Control Plan", { timeout: 3_000 });
  }).toPass({ timeout: 45_000 });

  // --- Print, Excel, PDF ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/16/print`);
  await expect(printPage.getByText("MASTER LIST OF MEASURING INSTRUMENTS")).toBeVisible();
  await expect(printPage.getByRole("cell", { name: "E2E-MM-01" })).toBeVisible();
  await printPage.close();

  const excelHref = await page.locator('a[href^="/api/checking-aids/"]').getAttribute("href");
  const excel = await page.request.get(excelHref!);
  expect(excel.status()).toBe(200);
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK");
  const pdf = await page.request.get(`/api/ppap/${ppapId}/16/pdf`, { timeout: 60_000 });
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
