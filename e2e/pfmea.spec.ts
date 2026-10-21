import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("PFMEA: sync from PFC, add failure mode, AP computes, filters, print, Excel import flags AP disagreements", async ({ page }) => {
  test.setTimeout(150_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E PFMEA Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E PFMEA Test Part");
  await page.getByLabel("Part number").fill("E2E-PFMEA-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-PFMEA-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  // --- Set up a PFC route so "Sync from PFC" has something to pull in ---
  await page.goto(`/ppap/${ppapId}/5`);
  await page.getByRole("button", { name: "Add child part" }).click();
  await page.locator("#pfc-new-partno").fill("TEST-001");
  await page.locator("#pfc-new-description").fill("Test Bracket");
  await page.getByRole("button", { name: "Add child part" }).click();
  await expect(page.getByRole("cell", { name: "TEST-001" })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "0 steps" }).click();
  await page.getByRole("combobox").first().selectOption({ label: "Welding" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Welding").first()).toBeVisible({ timeout: 20_000 });

  // --- PFMEA: sync the step in, add a failure mode ---
  await page.goto(`/ppap/${ppapId}/6`);
  await expect(page.getByText("6. PFMEA")).toBeVisible();
  await expect(page.getByText("No process steps yet.")).toBeVisible();

  await page.getByRole("button", { name: "Sync from PFC" }).click();
  // Adding "Welding" in PFC auto-inserts an Inspection step after it, so
  // syncing pulls in both.
  await expect(page.getByText(/Synced from PFC: 2 step/)).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByText("Welding", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "+ Add failure mode" }).first().click();
  await expect(page.getByLabel("Potential Failure Mode", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Potential Failure Mode", { exact: true }).fill("Porosity");
  await page.getByLabel("Severity", { exact: true }).fill("9");
  await page.getByLabel("Occurrence", { exact: true }).fill("5");
  await page.getByLabel("Detection", { exact: true }).fill("2");
  // Trigger the row's onBlur save by moving focus to the next field.
  await page.getByLabel("Recommended Actions", { exact: true }).focus();

  // RPN = 9*5*2 = 90; AP for S9 O5 D2 is High per the AIAG-VDA table.
  await expect(page.getByText("90", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("HIGH").first()).toBeVisible({ timeout: 20_000 });

  // --- Filters ---
  await page.getByLabel("High AP only").check();
  await expect(page.getByText("Porosity")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("High AP only").uncheck();

  // --- Print view ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/6/print`);
  await expect(printPage.getByText("Welding", { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  await expect(printPage.getByText(/Sheet 1 of/)).toBeVisible();
  await printPage.close();

  // --- Excel import: the real sample flags typed-AP disagreements ---
  const referencePath = path.join(process.cwd(), "reference", "PPAP_Checklist.xlsx");
  await page.goto(`/ppap/${ppapId}/6`);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(referencePath);
  await page.getByRole("button", { name: "Import Excel" }).click();
  await expect(page.getByText(/Imported 68 rows\. \d+ row\(s\) have a typed Action Priority that disagrees/)).toBeVisible({
    timeout: 60_000,
  });
});
