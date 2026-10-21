import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("RM Test Reports: seeded sample imports all 9 real rows", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/seed-ppap-1170750-raw-h/10");
  await expect(page.getByRole("main").getByText("10. Material / Performance Test Results")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "T30585" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "408508" })).toBeVisible();
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(9, { timeout: 20_000 });
});

test("RM Test Reports: an observed 3.4mm on a 3mm plate is flagged", async ({ page }) => {
  test.setTimeout(150_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E RMTC Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E RMTC Test Part");
  await page.getByLabel("Part number").fill("E2E-RMTC-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-RMTC-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/10`);
  await expect(page.getByRole("main").getByText("10. Material / Performance Test Results")).toBeVisible();

  await page.getByRole("button", { name: "+ Add row" }).click();
  await expect(page.getByLabel("Sl No")).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Sl No").fill("1");
  await page.getByLabel("Required Size").fill("3X1250X2500");
  await page.getByLabel("Observed Size").fill("3.4X1250X2500");
  // Trigger the row's onBlur save by moving focus to the next field.
  await page.getByLabel("Heat No", { exact: true }).focus();

  await expect(page.getByLabel("Observed Size")).toHaveClass(/border-red-500/, { timeout: 20_000 });
  await expect(page.getByText(/NG \(thickness\)/)).toBeVisible();

  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/10/print`);
  await expect(printPage.getByText("Material Performance Test Results")).toBeVisible({ timeout: 20_000 });
  await printPage.close();
});
