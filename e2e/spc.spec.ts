import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

// Real element-11 sample (part 1368082, Ø76 -0.355/0, USL=76/LSL=75.645),
// 5 subgroups of 5. See lib/calc/spc.test.ts for the fixture note on the
// one cell the two legacy sheets disagree on (subgroup 1, 3rd reading).
const SUBGROUPS = [
  [75.862, 75.789, 75.755, 75.854, 75.875],
  [75.75, 75.894, 75.858, 75.862, 75.755],
  [75.758, 75.898, 75.855, 75.9, 75.844],
  [75.895, 75.787, 75.902, 75.89, 75.904],
  [75.882, 75.859, 75.785, 75.758, 75.875],
];

test("SPC: the sample's 25 readings give Cp 1.066 / Cpk 0.949 with the client method, not the sheet's typed 1.072 / 0.954", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E SPC Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E SPC Test Part");
  await page.getByLabel("Part number").fill("E2E-SPC-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-SPC-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  // --- Element 1: add the special characteristic SPC studies are restricted to ---
  await page.goto(`/ppap/${ppapId}/1`);
  const scSection = page.getByRole("heading", { name: "Special Characteristics" }).locator("..");
  await scSection.getByRole("button", { name: "Add row" }).click();
  await page.getByLabel("Characteristic").fill("Bore Diameter");
  await scSection.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("cell", { name: "Bore Diameter" })).toBeVisible({ timeout: 20_000 });

  // --- Element 7: Control Plan row naming that characteristic with a
  // numeric spec, so element 11 can auto-fill USL/LSL from it ---
  await page.goto(`/ppap/${ppapId}/7`);
  await page.getByRole("button", { name: "+ Add row" }).click();
  await expect(page.getByLabel("Special Characteristic")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Special Characteristic").selectOption({ label: "Bore Diameter" });
  await page.getByLabel("Product/Process Specification/Tolerance").fill("76 +0/-0.355");
  await page.getByLabel("Product/Process Specification/Tolerance").blur();
  await page.waitForTimeout(500); // let the onBlur save land before navigating away

  // --- Element 11: create the study, confirm USL/LSL auto-filled ---
  await page.goto(`/ppap/${ppapId}/11`);
  await expect(page.getByRole("main").getByText("11. SPC Results")).toBeVisible();
  await page.getByRole("button", { name: "+ Add Study" }).click();
  await page.getByLabel("Characteristic (Control Plan)").selectOption({ label: "Bore Diameter (CRITICAL)" });
  await page.getByRole("button", { name: "Create Study" }).click();
  await expect(page.getByText("USL 76 / LSL 75.645")).toBeVisible({ timeout: 20_000 });

  // --- Fill the 5x5 subgroup grid with the real sample ---
  for (let s = 0; s < SUBGROUPS.length; s++) {
    for (let w = 0; w < SUBGROUPS[s].length; w++) {
      await page.getByLabel(`Subgroup ${s + 1} reading ${w + 1}`).fill(String(SUBGROUPS[s][w]));
    }
  }
  await page.getByRole("button", { name: "Save Data" }).click();
  await expect(page.getByText("Data saved.")).toBeVisible({ timeout: 20_000 });
  await page.reload();

  // --- Client-method Cp/Cpk: 1.066 / 0.949, not the sheet's typed 1.072 / 0.954 ---
  await expect(page.getByText("Cpk 0.949")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Not acceptable")).toBeVisible();
  await expect(page.getByText(/Client method.*1\.066.*0\.949/)).toBeVisible();

  // --- Summary feeds the checklist, and cannot claim Cpk > 1.67 ---
  await page.getByRole("button", { name: "Copy summary to Checklist" }).click();
  await expect(page.getByText("Copied to Checklist.")).toBeVisible({ timeout: 20_000 });
  await page.goto(`/ppap/${ppapId}/0`);
  const remarksCell = page.locator('input[name="remarks-11"]').first();
  await expect(remarksCell).toHaveValue(/Cpk = 0\.949 \(NOT_ACCEPTABLE\)/, { timeout: 20_000 });

  // --- Print view ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/11/print`);
  await expect(printPage.getByText("STATISTICAL PROCESS CONTROL STUDY")).toBeVisible({ timeout: 20_000 });
  await expect(printPage.getByText("Not acceptable")).toBeVisible();
  await printPage.close();
});
