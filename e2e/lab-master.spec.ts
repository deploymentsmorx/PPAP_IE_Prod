import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("Labs master: an expired lab shows EXPIRED and can't be picked; renewing it makes it pickable", async ({ page }) => {
  test.setTimeout(120_000);
  const labName = `E2E Lab ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // --- Add an already-expired lab ---
  await page.goto("/labs");
  await page.getByLabel("Lab name").fill(labName);
  await page.getByLabel("Accreditation").fill("NABL");
  await page.getByLabel("Certificate no.").fill("TC-E2E-1");
  await page.getByLabel("Scope").fill("Chemical testing");
  await page.getByLabel("Valid until").fill("2025-06-30");
  await page.getByRole("button", { name: "Add Lab" }).click();
  const row = page.getByRole("row", { name: new RegExp(labName) });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByText("EXPIRED", { exact: true })).toBeVisible();

  // --- It can't be selected on a lab report ---
  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E Lab Master Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E Lab Master Part");
  await page.getByLabel("Part number").fill("E2E-LABM-001");
  await page.getByLabel("Revision letter").fill("A");
  await page.getByLabel("Drawing number").fill("DWG-E2E-LABM-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  // Creating a PPAP redirects to its overview page, /ppap/<id>.
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/12`);
  await page.getByRole("button", { name: "+ Add Report" }).click();
  await expect(page.getByLabel("Lab").locator("option", { hasText: labName })).toHaveAttribute("disabled", "");

  // --- Renew it: VALID, and now pickable ---
  await page.goto("/labs");
  await page.getByRole("row", { name: new RegExp(labName) }).getByRole("button", { name: "Edit" }).click();
  await page.locator('input[name="validUntil"]').last().fill("2030-12-31");
  await page.getByRole("button", { name: "Save Lab" }).click();
  await expect(page.getByRole("row", { name: new RegExp(labName) }).getByText("VALID", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.goto(`/ppap/${ppapId}/12`);
  await page.getByRole("button", { name: "+ Add Report" }).click();
  await expect(page.getByLabel("Lab").locator("option", { hasText: labName })).not.toHaveAttribute("disabled", "");
});
