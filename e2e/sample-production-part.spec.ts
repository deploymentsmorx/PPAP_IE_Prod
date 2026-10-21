import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

// Acceptance: the seeded NBL PPAP (real data on pages 5-10 and 13) shows
// sections 1, 3, 4, 5, 7, 8 populated without typing. View-only — this
// test never writes to the seeded PPAP.
test("Sample Production Part: a filled PPAP shows sections 1, 3, 4, 5, 7, 8 without typing", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/ppap/seed-ppap-1170750-raw-h/14");
  await expect(page.getByRole("main").getByText("14. Sample Production Part")).toBeVisible();

  const section = (n: number) => page.locator(`[data-section="${n}"]`);

  await expect(section(1)).toContainText("TLD STL");
  await expect(section(1)).toContainText("1170750-RAW");
  await expect(section(1)).toContainText("Level 3");

  await expect(section(3)).toContainText("E250 BR");
  await expect(section(3).locator("tbody tr").first()).toBeVisible();

  await expect(section(4)).toContainText(/\d+ dimensions — \d+ checked/);
  await expect(section(4).locator("tbody tr").first()).toBeVisible();

  await expect(section(5)).toContainText("Colour / Shade");

  await expect(section(7)).toContainText("Welding");
  await expect(section(7)).toContainText(/Control Plan Available\s*Yes/);

  await expect(section(8).locator("tbody tr").first()).toBeVisible();
  await expect(section(8)).toContainText(/Calibrated|Due is near|Overdue|No calibration record/);

  // Every read-only section links to its source page.
  await expect(section(3).getByRole("link", { name: "10. Material, Performance and Functional Test Results" })).toBeVisible();
  await expect(section(8).getByRole("link", { name: "8. Measurement System Analysis (MSA)" })).toBeVisible();
});

test("Sample Production Part: sample register, QR tags, tests, packaging, AAR sample IDs, exports", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E SPP Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E SPP Test Part");
  await page.getByLabel("Part number").fill("E2E-SPP-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-SPP-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/14`);
  await expect(page.getByText("No samples registered yet.")).toBeVisible();

  // --- Sample register: two samples get consecutive IDs ---
  await page.getByRole("button", { name: "+ Add sample" }).click();
  await expect(page.getByLabel("Sample ID")).toHaveCount(1);
  await page.getByRole("button", { name: "+ Add sample" }).click();
  await expect(page.getByLabel("Sample ID")).toHaveCount(2);
  const firstId = await page.getByLabel("Sample ID").nth(0).inputValue();
  const secondId = await page.getByLabel("Sample ID").nth(1).inputValue();
  expect(firstId).toMatch(/-01$/);
  expect(secondId).toMatch(/-02$/);
  await expect(page.getByText("Sample Quantity Submitted: 2")).toBeVisible();

  await page.getByLabel(`${firstId} lot / batch no`).fill("LOT-A1");
  await page.getByLabel(`${firstId} manufacturing date`).fill("2026-09-10");

  // --- Functional test + packaging ---
  await page.getByRole("button", { name: "+ Add test" }).click();
  await expect(page.getByLabel("Test 1 name")).toBeVisible();
  await page.getByLabel("Test 1 name").fill("Load test");
  await page.getByLabel("Test 1 specification").fill("No deformation at 2x rated load");
  await page.getByLabel("Test 1 result").fill("No deformation");
  await page.getByLabel("Test 1 status").selectOption("OK");
  await page.getByLabel("Packing Method").fill("Wooden pallet");

  await page.getByRole("button", { name: "Save Sample Production Part" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(`${firstId} lot / batch no`)).toHaveValue("LOT-A1");
  await expect(page.getByLabel("Test 1 name")).toHaveValue("Load test");
  await expect(page.getByLabel("Packing Method")).toHaveValue("Wooden pallet");

  // --- QR sample tags: one per sample ---
  const tagsPage = await page.context().newPage();
  await tagsPage.goto(`/ppap/${ppapId}/14/tags`);
  await expect(tagsPage.getByTestId("sample-tag")).toHaveCount(2);
  await expect(tagsPage.getByTestId("sample-tag").first().locator("svg")).toBeVisible();
  await expect(tagsPage.getByTestId("sample-tag").first()).toContainText(firstId);
  await expect(tagsPage.getByTestId("sample-tag").first()).toContainText("10-09-2026");
  await tagsPage.close();

  // --- AAR (element 13) picks up the sample IDs ---
  await page.goto(`/ppap/${ppapId}/13`);
  await expect(page.getByLabel("Sample Identification / Batch No.")).toHaveValue(`${firstId}, ${secondId}`);

  // --- Print, Excel, PDF ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/14/print`);
  await expect(printPage.getByText("PRODUCTION PART SAMPLE FORMAT")).toBeVisible();
  await expect(printPage.getByText("Load test")).toBeVisible();
  await printPage.close();

  await page.goto(`/ppap/${ppapId}/14`);
  const excelHref = await page.locator('a[href^="/api/spp/"]').getAttribute("href");
  const excel = await page.request.get(excelHref!);
  expect(excel.status()).toBe(200);
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK");

  const pdf = await page.request.get(`/api/ppap/${ppapId}/14/pdf`, { timeout: 60_000 });
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
