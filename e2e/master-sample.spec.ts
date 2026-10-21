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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const indiaDate = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;

// Acceptance: the reference sheet's row NBL-001 is imported (seed), and
// expiry = approval + 3 years. View-only on the seeded PPAP.
test("Master Sample: NBL-001 imported; expiry = approval date + 3 years", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/ppap/seed-ppap-1170750-raw-h/15");

  const row = page.getByTestId("master-sample-NBL-001");
  await expect(row).toBeVisible();
  await expect(row.getByLabel("NBL-001 approval date")).toHaveValue("2026-10-04");
  await expect(row.getByLabel("NBL-001 storage location")).toHaveValue("Prod. Area");
  await expect(row.getByLabel("NBL-001 retention years")).toHaveValue("3");
  await expect(row.getByLabel("NBL-001 status")).toHaveValue("ACTIVE");
  await expect(row.getByTestId("expiry")).toHaveText("04-10-2029");

  const printPage = await page.context().newPage();
  await printPage.goto("/ppap/seed-ppap-1170750-raw-h/15/print");
  await expect(printPage.getByRole("cell", { name: "NBL-001" })).toBeVisible();
  await expect(printPage.getByRole("cell", { name: "04-10-2029" })).toBeVisible();
  await printPage.goto("/ppap/seed-ppap-1170750-raw-h/15/tags");
  await expect(printPage.getByTestId("sample-tag")).toHaveCount(1);
  await expect(printPage.getByTestId("sample-tag")).toContainText("Expiry: 04-10-2029");
  await expect(printPage.getByTestId("sample-tag").locator("svg")).toBeVisible();
  await printPage.close();
});

test("Master Sample: 30-day expiry reminder, and approving a newer revision supersedes the old one", async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);

  // --- PPAP for Rev A ---
  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E MS Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E MS Test Part");
  await page.getByLabel("Part number").fill("E2E-MS-001");
  await page.getByLabel("Revision letter").fill("A");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapA = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  // A master sample approved 3 years minus 10 days ago → expires in 10 days.
  const now = new Date();
  const approval = new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), now.getUTCDate() + 10));
  const expiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 10));

  await page.goto(`/ppap/${ppapA}/15`);
  await page.getByRole("button", { name: "+ Add master sample" }).click();
  await expect(page.getByLabel("Sample ID")).toHaveValue("MS-001");
  await expect(page.getByLabel("MS-001 retention years")).toHaveValue("3");
  await page.getByLabel("MS-001 approval date").fill(isoDate(approval));
  await page.getByLabel("MS-001 storage location").fill("QA Lab rack 2");
  await expect(page.getByTestId("expiry")).toHaveText(indiaDate(expiry));
  await expect(page.getByText("Expires in 10 day(s)")).toBeVisible();
  await page.getByRole("button", { name: "Save register" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // --- Reminder also on the PPAP list ---
  await page.goto("/");
  const reminders = page.getByTestId("master-sample-reminders");
  await expect(reminders).toContainText("E2E MS Test Part");
  await expect(reminders.locator("li", { hasText: "E2E MS Test Part" })).toContainText("Expires in 10 day(s)");

  // --- PPAP for Rev B of the same part ---
  await page.goto("/ppap/new");
  await page.locator('select[name="customerId"]').selectOption({ label: "E2E MS Test Customer" });
  await page.locator('input[name="partMode"][value="existing"]').check();
  await page.locator('select[name="partId"]').selectOption({ label: "E2E MS Test Part (E2E-MS-001)" });
  await page.getByLabel("Revision letter").fill("B");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapB = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];
  expect(ppapB).not.toBe(ppapA);

  await page.goto(`/ppap/${ppapB}/15`);
  await page.getByRole("button", { name: "+ Add master sample" }).click();
  await expect(page.getByLabel("Sample ID")).toHaveValue("MS-001");
  await page.getByLabel("MS-001 approval date").fill(isoDate(now));
  await page.getByRole("button", { name: "Save register" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  // Rev A's sample shows in the history, still active.
  await expect(page.getByRole("link", { name: "Rev A" })).toBeVisible();

  // --- Approve Rev B's master sample page → Rev A's sample is superseded ---
  await page.locator("#sig-APPROVED-by").selectOption({ label: "Rajesh Goel" });
  await page.getByRole("button", { name: "Save signatures" }).click();
  await expect(page.getByText("This page is approved and locked for editing.")).toBeVisible({ timeout: 20_000 });

  await page.goto(`/ppap/${ppapA}/15`);
  await expect(page.getByLabel("MS-001 status")).toHaveValue("SUPERSEDED");
  await expect(page.getByText(/Auto-superseded .* by Rev B/)).toBeVisible();

  // A superseded sample no longer appears in the expiry reminders.
  await page.goto("/");
  await expect(page.getByText("E2E MS Test Part · E2E-MS-001 Rev.A")).toHaveCount(0);

  // --- Excel export ---
  await page.goto(`/ppap/${ppapA}/15`);
  const excelHref = await page.locator('a[href^="/api/master-sample/"]').getAttribute("href");
  const excel = await page.request.get(excelHref!);
  expect(excel.status()).toBe(200);
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK");
});
