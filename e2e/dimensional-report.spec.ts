import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("Dimensional Report: seeded sample imports all 146 real rows", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/seed-ppap-1170750-raw-h/9");
  await expect(page.getByRole("main").getByText("9. Dimensional Report")).toBeVisible({ timeout: 20_000 });
  // The sheet's own numbering runs 1-143, but 3 rows ("60 A", "60 B",
  // "127 A") are lettered sub-items, so the true faithful count is 146.
  await expect(page.getByText(/^146 rows/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "Coupe A-A" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Coupe T-T" })).toBeVisible();
});

test("Dimensional Report: a reading outside tolerance turns NG and feeds the checklist", async ({ page }) => {
  test.setTimeout(150_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E Dimensional Report Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E Dimensional Report Test Part");
  await page.getByLabel("Part number").fill("E2E-DR-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-DR-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/9`);
  await expect(page.getByRole("main").getByText("9. Dimensional Report")).toBeVisible();

  await page.getByRole("button", { name: "+ Add row (no view)" }).click();
  await expect(page.getByLabel("Sl No")).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Sl No").fill("1");
  await page.getByLabel("Design Dimension").fill("100");
  await page.getByLabel("Tolerance").fill("±2");
  await page.getByLabel("T/W reading").fill("103");
  // Trigger the row's onBlur save by moving focus to the next field.
  await page.getByLabel("Remarks").focus();

  await expect(page.getByText(/1 checked, 0 OK, 1 NG/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("T/W reading")).toHaveClass(/border-red-500/);

  await page.getByRole("button", { name: "Copy summary to Checklist" }).click();
  await expect(page.getByText("Copied to Checklist.")).toBeVisible({ timeout: 20_000 });
  await page.goto(`/ppap/${ppapId}/0`);
  const remarksCell = page.locator('input[name="remarks-9"]').first();
  await expect(remarksCell).toHaveValue(/1 NG/, { timeout: 20_000 });

  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/9/print`);
  await expect(printPage.getByText("Inspection Report")).toBeVisible({ timeout: 20_000 });
  await expect(printPage.getByText("NG", { exact: true })).toBeVisible();
  await printPage.close();
});
