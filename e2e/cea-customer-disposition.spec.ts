import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("CEA customer disposition respects both approval modes", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // --- Create a fresh PPAP (defaults to supplier-upload mode) ---
  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E CEA Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E CEA Test Part");
  await page.getByLabel("Part number").fill("E2E-CEA-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-CEA-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/3`);
  await expect(page.getByText("10. Customer Approval")).toBeVisible();

  // --- Supplier-upload mode: fill disposition, file required before save ---
  await page.locator("#cd-status").selectOption("APPROVED");
  await page.locator("#cd-customer-name").fill("Jane Customer");
  await page.locator("#cd-customer-designation").fill("Quality Lead");
  await page.setInputFiles("#cd-file", { name: "signed.pdf", mimeType: "application/pdf", buffer: Buffer.from("test") });
  await page.getByRole("button", { name: "Save disposition" }).click();

  await expect(page.getByText(/Recorded by .* from signed copy/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("signed.pdf")).toBeVisible();

  // --- Switch to customer-portal mode ---
  await page.getByText("Supplier upload", { exact: true }).click();
  await page.locator("select").filter({ hasText: "Supplier upload" }).selectOption("CUSTOMER_PORTAL");
  await page.getByPlaceholder("Reason for change").fill("Testing portal mode");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Customer portal", { exact: true })).toBeVisible();

  // --- A non-approver (current logged-in supplier user) now sees it read-only ---
  await page.reload();
  await expect(page.getByText(/Read-only — only that customer's approver/)).toBeVisible();
  await expect(page.locator("#cd-status")).toHaveCount(0);
});
