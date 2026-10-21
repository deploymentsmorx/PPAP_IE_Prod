import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("PFC: add child part, edit route, print view, Excel import round-trip", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E PFC Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E PFC Test Part");
  await page.getByLabel("Part number").fill("E2E-PFC-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-PFC-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/5`);
  await expect(page.getByText("5. Process Flow Chart")).toBeVisible();
  await expect(page.getByText("No child parts yet.")).toBeVisible();

  // --- Add a child part manually ---
  await page.getByRole("button", { name: "Add child part" }).click();
  await page.getByLabel("Part No.").fill("TEST-001");
  await page.getByLabel("Description").fill("Test Bracket");
  await page.getByLabel("Qty/Str").fill("2");
  await page.getByRole("button", { name: "Add child part" }).click();
  await expect(page.getByRole("cell", { name: "TEST-001" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "Test Bracket" })).toBeVisible();

  // --- Edit its route: add an operation, confirm auto-inserted Inspection ---
  await page.getByRole("button", { name: "0 steps" }).click();
  await page.getByRole("combobox").first().selectOption({ label: "Laser cutting" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Laser cutting").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Inspection").first()).toBeVisible();

  // Remove the auto-inserted Inspection step (second chip), leaving just Laser cutting.
  await page.getByRole("button", { name: "×" }).last().click();
  await expect(page.getByRole("button", { name: "×" })).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByRole("button", { name: "1 steps" })).toBeVisible({ timeout: 20_000 });

  // --- Print view ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/5/print`);
  await expect(printPage.getByText("TEST-001")).toBeVisible();
  await expect(printPage.getByText(/Sheet 1 of/)).toBeVisible();
  await printPage.close();

  // --- Excel import: the real 81-row reference sample reproduces all parts ---
  const referencePath = path.join(process.cwd(), "reference", "PPAP_Checklist.xlsx");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(referencePath);
  await page.getByRole("button", { name: "Import Excel" }).click();
  await expect(page.getByText("Imported 81 child parts.")).toBeVisible({ timeout: 60_000 });

  await page.reload();
  await expect(page.getByText("LIFTING RING").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("4100016").first()).toBeVisible();
});
