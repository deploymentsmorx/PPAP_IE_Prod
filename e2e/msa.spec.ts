import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("MSA: 10x3x3 Variable GR&R study produces results/charts and feeds the checklist", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E MSA Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E MSA Test Part");
  await page.getByLabel("Part number").fill("E2E-MSA-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-MSA-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/8`);
  await expect(page.getByRole("main").getByText("8. MSA")).toBeVisible();

  // --- Set up the sample study: Vernier, 20 +/- 0.2, 10 parts x 3 appraisers x 3 trials ---
  await page.getByRole("button", { name: "+ Add Study" }).click();
  await page.getByLabel("Gauge Type").fill("Vernier Caliper");
  await page.getByLabel("USL").fill("20.2");
  await page.getByLabel("LSL").fill("19.8");
  await page.getByLabel("Appraiser A").fill("Alice");
  await page.getByLabel("Appraiser B").fill("Bob");
  await page.getByLabel("Appraiser C").fill("Carol");
  // parts/appraisers/trials already default to 10/3/3.
  await page.getByRole("button", { name: "Create Study" }).click();
  await expect(page.getByText("10p × 3o × 3n")).toBeVisible({ timeout: 20_000 });

  // --- Fill the 10x3x3 data grid with synthetic in-tolerance readings ---
  const appraisers = ["Alice", "Bob", "Carol"];
  for (let a = 0; a < appraisers.length; a++) {
    for (let t = 0; t < 3; t++) {
      for (let p = 0; p < 10; p++) {
        const value = (20 + p * 0.01 + a * 0.02 + t * 0.005).toFixed(3);
        await page.getByLabel(`${appraisers[a]} trial ${t + 1} part ${p + 1}`, { exact: true }).fill(value);
      }
    }
  }

  await page.getByRole("button", { name: "Save Data" }).click();
  await expect(page.getByText("Data saved.")).toBeVisible({ timeout: 20_000 });
  await page.reload();

  // --- Results + charts ---
  await expect(page.getByText(/^GRR \d+\.\d%$/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Averages by Appraiser")).toBeVisible();
  await expect(page.getByText("Range by Appraiser")).toBeVisible();
  await expect(page.getByText(/Bias & Consistency/)).toBeVisible();

  // --- Summary feeds the checklist ---
  await page.getByRole("button", { name: "Copy summary to Checklist" }).click();
  await page.goto(`/ppap/${ppapId}/0`);
  const remarksCell = page.locator('textarea[name="remarks-8"], input[name="remarks-8"]').first();
  await expect(remarksCell).toHaveValue(/GRR \d+\.\d%/, { timeout: 20_000 });

  // --- Print view ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/8/print`);
  await expect(printPage.getByText("MEASUREMENT SYSTEM ANALYSIS (MSA)")).toBeVisible({ timeout: 20_000 });
  await expect(printPage.getByText("Verdict")).toBeVisible();
  await printPage.close();
});
