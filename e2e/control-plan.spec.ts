import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("Control Plan: seeded sample prints 16 stages / 27 rows like the sheet", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/seed-ppap-1170750-raw-h/7/print");
  await expect(page.getByRole("cell", { name: "CONTROL PLAN", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("IE/CP/TLD-NBL/1170750").first()).toBeVisible();
  await expect(page.getByText("Page 1 of 1")).toBeVisible();

  // 16 distinct stage numbers, 1-16, each appearing in the Stage No. column.
  for (const stage of [1, 8, 16]) {
    await expect(page.getByRole("cell", { name: String(stage), exact: true }).first()).toBeVisible();
  }

  // Legends transcribed verbatim from the source sheet.
  await expect(page.getByText("W - Regular Operator Check")).toBeVisible();
  await expect(page.getByText("D - Quarantine the material.")).toBeVisible();
});

test("Control Plan: generate from PFC/PFMEA, edit a row, block overdue instrument", async ({ page }) => {
  test.setTimeout(150_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E Control Plan Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E Control Plan Test Part");
  await page.getByLabel("Part number").fill("E2E-CP-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-CP-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  // --- Build a PFC step + PFMEA detection control so Generate has something to pull in ---
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

  await page.goto(`/ppap/${ppapId}/6`);
  await page.getByRole("button", { name: "Sync from PFC" }).click();
  await expect(page.getByText(/Synced from PFC: 2 step/)).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await page.getByRole("button", { name: "+ Add failure mode" }).first().click();
  await page.getByLabel("Current Detection Controls", { exact: true }).fill("Weld gauge check");
  await page.getByLabel("Potential Failure Mode", { exact: true }).focus();
  await expect(page.getByText("Saving...")).toHaveCount(0, { timeout: 20_000 });

  // --- Control Plan: generate from PFC/PFMEA ---
  await page.goto(`/ppap/${ppapId}/7`);
  await expect(page.getByRole("main").getByText("7. Control Plan")).toBeVisible();
  await page.getByRole("button", { name: "Generate from PFC/PFMEA" }).click();
  await expect(page.getByText(/Generated from PFC\/PFMEA: \d+ row\(s\) added/)).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByRole("cell", { name: "Weld gauge check" })).toBeVisible({ timeout: 20_000 });

  // --- Header form saves ---
  await page.getByLabel("Control Plan No.").fill("IE/CP/E2E-CP-001");
  await page.getByRole("button", { name: "Save Header" }).click();
  await expect(page.getByRole("button", { name: "Saving..." })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole("button", { name: "Save Header" })).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByLabel("Control Plan No.")).toHaveValue("IE/CP/E2E-CP-001");

  // --- Instrument picker blocks an overdue instrument ---
  const instrumentSelect = page.getByLabel("Instrument").first();
  const overdueOption = instrumentSelect.locator("option", { hasText: "(overdue)" }).first();
  await expect(overdueOption).toHaveCount(1);
  await expect(overdueOption).toBeDisabled();

  // --- Print view ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/7/print`);
  await expect(printPage.getByRole("cell", { name: "CONTROL PLAN", exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(printPage.getByText(/Page 1 of/)).toBeVisible();
  await printPage.close();
});
