import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const tsxCli = () => require.resolve("tsx/cli");

test.afterAll(() => {
  execFileSync(process.execPath, [tsxCli(), "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

async function login(page: Page, email = "santhosh.bg@ingenious-engineering.local") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
}

async function createPpap(page: Page, customer: string, partNo: string) {
  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill(customer);
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill(`${customer} Part`);
  await page.getByLabel("Part number").fill(partNo);
  await page.getByLabel("Revision letter").fill("A");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  return new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];
}

async function approvePage(page: Page, ppapId: string, elementNo: number) {
  await page.goto(`/ppap/${ppapId}/${elementNo}`);
  await page.locator("#sig-APPROVED-by").selectOption({ label: "Rajesh Goel" });
  await page.getByRole("button", { name: "Save signatures" }).click();
  await expect(page.getByText("This page is approved and locked for editing.")).toBeVisible({ timeout: 20_000 });
}

/** Closes every readiness gap: 1-17 N/A via the checklist except 9, then approve 9 and the checklist. */
async function closeGaps(page: Page, ppapId: string) {
  await page.goto(`/ppap/${ppapId}/0`);
  for (let n = 1; n <= 17; n++) {
    if (n !== 9) await page.locator(`input[name="required-${n}"]`).fill("N");
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Applicability updated on page\(s\)/)).toBeVisible({ timeout: 30_000 });
  await approvePage(page, ppapId, 9);
  await approvePage(page, ppapId, 0);
}

async function signPsw(page: Page, ppapId: string) {
  await page.goto(`/ppap/${ppapId}/18`);
  await expect(page.getByTestId("psw-ready")).toBeVisible();
  await expect(page.getByTestId("result-dimensional measurements")).toHaveAttribute("data-value", "YES");
  await expect(page.getByTestId("result-appearance criteria")).toHaveAttribute("data-value", "NA");
  const initial = page.getByLabel("Initial submission");
  if (!(await initial.isChecked())) await initial.check();
  await page.locator('input[name="resultsMeetRequirements"][value="Y"]').check();
  await page.getByRole("button", { name: "Sign PSW" }).click();
  await expect(page.getByTestId("psw-signed")).toContainText("E-signed by Santhosh BG", { timeout: 20_000 });
  await expect(page.getByTestId("ppap-status")).toHaveText("Submitted");
}

// Acceptance: signing is blocked on the seeded sample (view-only — the
// seeded PPAP is never modified here).
test("PSW: the seeded sample can't be signed — the gate lists what's missing; warrant fields auto-fill", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  await page.goto("/ppap/seed-ppap-1170750-raw-h/18");

  const gate = page.getByTestId("psw-gate");
  await expect(gate).toBeVisible();
  await expect(gate).toContainText("required element(s) not approved");
  await expect(gate).toContainText("9. Dimensional Results");
  await expect(gate).toContainText("17. Customer-Specific Requirements");
  await expect(page.getByRole("button", { name: "Sign PSW" })).toBeDisabled();

  // Auto-filled from master data / the sheet's seeded values.
  await expect(page.getByRole("main")).toContainText("Chassis Brut, NBL Raw Frame, NBL");
  await expect(page.getByRole("main")).toContainText("1170750-RAW (H)");
  await expect(page.getByRole("main")).toContainText("H — dated 16-09-2025");
  await expect(page.getByRole("main")).toContainText("831");
  await expect(page.getByRole("main")).toContainText("Plot No. 49-P2, Jakkasandra Industrial Area");
  await expect(page.getByRole("main")).toContainText("Application: Heavy Fabrication - Industrial");
  await expect(page.getByLabel("Initial submission")).toBeChecked();
  await expect(page.getByLabel("Print Name")).toHaveValue("Santhosh BG");

  const printPage = await page.context().newPage();
  await printPage.goto("/ppap/seed-ppap-1170750-raw-h/18/print");
  await expect(printPage.getByText("Part Submission Warrant (PSW)")).toBeVisible();
  await expect(printPage.getByText("FOR CUSTOMER USE ONLY")).toBeVisible();
  await expect(printPage.getByText("☑ Level 3 - Warrant with Product Samples and complete supporting data submitted to customer")).toBeVisible();
  await printPage.close();
});

test("PSW: supplier-upload mode — close gaps, sign, customer approval from signed copy closes the PPAP", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  const ppapId = await createPpap(page, "E2E PSW Upload Customer", "E2E-PSWU-001");

  await page.goto(`/ppap/${ppapId}/18`);
  await expect(page.getByRole("button", { name: "Sign PSW" })).toBeDisabled();
  await expect(page.getByText("Available once the supplier has signed the PSW.")).toBeVisible();

  await closeGaps(page, ppapId);
  await signPsw(page, ppapId);

  // Customer disposition from the uploaded signed copy.
  await page.locator("#cd-status").selectOption("APPROVED");
  await page.locator("#cd-customer-name").fill("Jane Customer");
  await page.setInputFiles("#cd-file", { name: "psw-signed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 signed") });
  await page.getByRole("button", { name: "Save disposition" }).click();
  await expect(page.getByTestId("ppap-status")).toHaveText("Closed", { timeout: 20_000 });
  await expect(page.getByTestId("ppap-closed-banner")).toBeVisible();
  await expect(page.getByText(/recorded by .* from signed copy/)).toBeVisible();

  // A closed PPAP can't be revised.
  await page.goto(`/ppap/${ppapId}/9`);
  await page.getByRole("button", { name: "Revise" }).click();
  await page.getByPlaceholder("Reason for revision").fill("try");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("signature-error")).toHaveText("This PPAP is closed — the customer approved the PSW. No further changes.");
  await page.reload();
  await expect(page.getByText("This page is approved and locked for editing.")).toBeVisible();

  const pdf = await page.request.get(`/api/ppap/${ppapId}/18/pdf`, { timeout: 60_000 });
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("PSW: customer-portal mode — approver rejects with comments (re-opens), supplier re-signs, approver approves (closes)", async ({ page }) => {
  test.setTimeout(360_000);
  await login(page);
  const customer = "E2E PSW Portal Customer";
  const ppapId = await createPpap(page, customer, "E2E-PSWP-001");

  // Portal mode must be chosen before the PSW is submitted.
  await page.goto(`/ppap/${ppapId}/18`);
  await page.getByText("Supplier upload", { exact: true }).click();
  await page.locator("select").filter({ hasText: "Supplier upload" }).selectOption("CUSTOMER_PORTAL");
  await page.getByPlaceholder("Reason for change").fill("Customer approves in the portal");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Customer portal", { exact: true })).toBeVisible();

  await closeGaps(page, ppapId);
  await signPsw(page, ppapId);
  // The supplier can't record the customer's disposition in portal mode.
  await expect(page.getByText(/Read-only — only that customer's approver/)).toBeVisible();

  const approver = `e2e-approver-${Date.now()}@customer.example`;
  execFileSync(process.execPath, [tsxCli(), "scripts/create-e2e-approver.ts", customer, approver], { stdio: "inherit" });

  // --- Approver rejects: comments required, then re-opens the PPAP ---
  await logout(page);
  await login(page, approver);
  await page.goto(`/ppap/${ppapId}/18`);
  await page.locator("#cd-status").selectOption("REJECTED");
  await page.getByRole("button", { name: "Save disposition" }).click();
  await expect(page.getByText("Rejecting the PSW requires comments explaining what must be corrected.")).toBeVisible();
  await page.locator("#cd-comments").fill("Hole 12 position out of tolerance — correct and resubmit.");
  await page.getByRole("button", { name: "Save disposition" }).click();
  await expect(page.getByTestId("ppap-status")).toHaveText("Open", { timeout: 20_000 });
  await expect(page.getByTestId("ppap-rejected-banner")).toContainText("Hole 12 position out of tolerance");

  // --- Supplier sees the rejection, re-signs ---
  await logout(page);
  await login(page);
  await page.goto(`/ppap/${ppapId}/18`);
  await expect(page.getByTestId("psw-signed")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign PSW" })).toBeEnabled();
  await page.getByRole("button", { name: "Sign PSW" }).click();
  await expect(page.getByTestId("ppap-status")).toHaveText("Submitted", { timeout: 20_000 });

  // --- Approver approves: PPAP closed ---
  await logout(page);
  await login(page, approver);
  await page.goto(`/ppap/${ppapId}/18`);
  await page.locator("#cd-status").selectOption("APPROVED");
  await page.locator("#cd-customer-name").fill("E2E Customer Approver");
  await page.getByRole("button", { name: "Save disposition" }).click();
  await expect(page.getByTestId("ppap-status")).toHaveText("Closed", { timeout: 20_000 });
  await expect(page.getByTestId("ppap-closed-banner")).toBeVisible();
});
