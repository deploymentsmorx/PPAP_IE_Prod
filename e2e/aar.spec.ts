import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("AAR: 8 seeded rows, NA state syncs with the checklist both ways, both approval modes work", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E AAR Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E AAR Test Part");
  await page.getByLabel("Part number").fill("E2E-AAR-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-AAR-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  // Creating a PPAP redirects to its overview page, /ppap/<id>.
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  // --- The 8 sheet rows are seeded; edits persist ---
  await page.goto(`/ppap/${ppapId}/13`);
  await expect(page.getByRole("main").getByText("13. Appearance Approval Report (AAR)")).toBeVisible();
  await expect(page.locator('input[name$="-parameter"]')).toHaveCount(8);
  await expect(page.getByLabel("Uniformity acceptance criteria")).toHaveValue("No variation");
  await page.getByLabel("Colour / Shade result").fill("Matches master sample");
  await page.getByLabel("Sample Size").fill("2 Nos");
  await page.getByRole("button", { name: "Save AAR" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Colour / Shade result")).toHaveValue("Matches master sample");

  // --- Page → checklist: marking N/A writes "N" ---
  const naToggle = page.getByLabel("AAR not required for this submission (N/A)");
  await naToggle.check();
  await expect(page.getByText("N/A — Not required per PPAP checklist")).toBeVisible();
  await page.goto(`/ppap/${ppapId}/0`);
  await expect(page.locator('input[name="required-13"]')).toHaveValue("N");

  // --- Checklist → page: "Y" makes it required again ---
  await page.locator('input[name="required-13"]').fill("Y");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Applicability updated on page(s) 13.")).toBeVisible();
  await page.goto(`/ppap/${ppapId}/13`);
  await expect(page.getByLabel("AAR not required for this submission (N/A)")).not.toBeChecked();
  await expect(page.getByLabel("Colour / Shade result")).toHaveValue("Matches master sample");

  // --- Checklist → page: "N" marks it N/A ---
  await page.goto(`/ppap/${ppapId}/0`);
  await page.locator('input[name="required-13"]').fill("N");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Applicability updated on page(s) 13.")).toBeVisible();
  await page.goto(`/ppap/${ppapId}/13`);
  await expect(page.getByText("N/A — Not required per PPAP checklist")).toBeVisible();
  await expect(page.getByLabel("AAR not required for this submission (N/A)")).toBeChecked();

  // Back to required for the approval-mode checks.
  await page.getByLabel("AAR not required for this submission (N/A)").uncheck();
  await expect(page.getByText("6. Customer Approval")).toBeVisible();

  // --- Supplier-upload mode: signed copy required, then recorded ---
  await page.locator("#cd-status").selectOption("APPROVED");
  await page.locator("#cd-customer-name").fill("Jane Customer");
  await page.locator("#cd-customer-designation").fill("Quality Lead");
  await page.setInputFiles("#cd-file", { name: "aar-signed.pdf", mimeType: "application/pdf", buffer: Buffer.from("test") });
  await page.getByRole("button", { name: "Save disposition" }).click();
  await expect(page.getByText(/Recorded by .* from signed copy/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("aar-signed.pdf")).toBeVisible();

  // --- Customer-portal mode: a supplier user sees it read-only ---
  await page.getByText("Supplier upload", { exact: true }).click();
  await page.locator("select").filter({ hasText: "Supplier upload" }).selectOption("CUSTOMER_PORTAL");
  await page.getByPlaceholder("Reason for change").fill("Testing portal mode on AAR");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Customer portal", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Read-only — only that customer's approver/)).toBeVisible();
  await expect(page.locator("#cd-status")).toHaveCount(0);

  // --- Print, Excel, PDF ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/13/print`);
  await expect(printPage.getByText("APPEARANCE APPROVAL REPORT (AAR)")).toBeVisible();
  await expect(printPage.getByText("Matches master sample")).toBeVisible();
  await printPage.close();

  const excelHref = await page.locator('a[href^="/api/aar/"]').getAttribute("href");
  const excel = await page.request.get(excelHref!);
  expect(excel.status()).toBe(200);
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK");

  const pdf = await page.request.get(`/api/ppap/${ppapId}/13/pdf`, { timeout: 60_000 });
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
