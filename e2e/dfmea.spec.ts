import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("DFMEA: add row, RPN computes, NA toggle reflected, print view works", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E DFMEA Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E DFMEA Test Part");
  await page.getByLabel("Part number").fill("E2E-DFMEA-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-DFMEA-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/4`);
  await expect(page.getByText("4. DFMEA")).toBeVisible();
  await expect(page.getByText("No DFMEA rows yet.")).toBeVisible();

  // --- Add a row and fill it in ---
  await page.getByRole("button", { name: "Add row" }).click();
  await expect(page.getByText("No DFMEA rows yet.")).not.toBeVisible();

  await page.getByLabel("Item/Function").fill("Bracket mounting hole");
  await page.getByLabel("Potential Failure Mode").fill("Hole mislocated");
  await page.getByLabel("Severity", { exact: true }).fill("8");
  await page.getByLabel("Occurrence", { exact: true }).fill("3");
  await page.getByLabel("Detection", { exact: true }).fill("2");
  await page.getByLabel("Recommended Actions").fill("Add in-process gauge check");
  // Trigger the row's onBlur save by moving focus to the next field.
  await page.getByLabel("Target Date").focus();

  // RPN is computed client-side from local draft state, so "48" appears
  // immediately — it doesn't by itself confirm the row was persisted.
  await expect(page.getByText("48", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  // Field saves are queued one after another; reloading before the queue
  // drains (slow against the hosted dev DB) would drop the later fields.
  await expect(page.getByText("Saving...")).toHaveCount(0, { timeout: 30_000 });

  // Reload to force a fresh server render, confirming the row (and its
  // recommended action) actually persisted and the Open Actions list picks it up.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Open Actions" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("48", { exact: true }).first()).toBeVisible();

  // --- NA toggle ---
  await page.getByLabel("Customer design — not in our scope").check();
  await expect(page.getByText("No DFMEA rows yet.")).toBeHidden({ timeout: 20_000 });
  await expect(page.getByLabel("Item/Function")).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel("Customer design — not in our scope")).toBeChecked();

  await page.getByLabel("Customer design — not in our scope").uncheck();
  await expect(page.getByText("48", { exact: true }).first()).toBeVisible({ timeout: 20_000 });

  // --- Print view ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/4/print`);
  await expect(printPage.getByText("Bracket mounting hole")).toBeVisible();
  await expect(printPage.getByText("48", { exact: true })).toBeVisible();
});
