import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { readOutlineTitles } from "../lib/pdf-outline";

// Acceptance for the whole app: the seeded NBL PPAP is cloned to a
// throwaway E2E customer/part (the seed itself is never modified), every
// required page is approved, the PSW signed, the customer approves — by
// uploaded signed copy in one test, by a customer login in the other — and
// the pack downloads.

const SEED = "seed-ppap-1170750-raw-h";
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

async function cloneSeed(page: Page, customer: string, partNo: string, approvalMode: "SUPPLIER_UPLOAD" | "CUSTOMER_PORTAL") {
  await page.goto(`/ppap/${SEED}/clone`);
  await page.getByLabel("A new part").check();
  await page.getByLabel("New customer").check();
  await page.getByLabel("New customer name").fill(customer);
  await page.getByLabel("Part number").fill(partNo);
  await page.getByLabel("Revision letter").fill("A");
  await page.locator("#clone-approvalMode").selectOption(approvalMode);
  await page.getByRole("button", { name: "Clone PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!seed-)[^/]+\/0$/, { timeout: 180_000 });
  return new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];
}

/** The dashboard's PSW decision row for this part (CEA, AAR and SPP decisions are listed too). */
const pswDecision = (page: Page, partNo: string) =>
  page.getByTestId("customer-decisions").locator("li", { hasText: partNo }).filter({ hasText: "18. Part Submission Warrant" });

async function approvePage(page: Page, ppapId: string, elementNo: number) {
  await page.goto(`/ppap/${ppapId}/${elementNo}`);
  await page.locator("#sig-APPROVED-by").selectOption({ label: "Rajesh Goel" });
  await page.getByRole("button", { name: "Save signatures" }).click();
  await expect(page.getByText("This page is approved and locked for editing.")).toBeVisible({ timeout: 30_000 });
}

/** Approves every element the PSW gate lists as missing, then e-signs the PSW. */
async function completeAndSign(page: Page, ppapId: string) {
  await page.goto(`/ppap/${ppapId}/18`);
  const gate = page.getByTestId("psw-gate");
  await expect(gate).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign PSW" })).toBeDisabled();
  const missing = (await gate.locator("a").evaluateAll((as) => as.map((a) => Number(a.getAttribute("href")!.split("/").pop())))).sort((a, b) => a - b);
  expect(missing.length).toBeGreaterThan(5);
  for (const n of missing) await approvePage(page, ppapId, n);

  await page.goto(`/ppap/${ppapId}/18`);
  await expect(page.getByTestId("psw-ready")).toBeVisible();
  await expect(page.getByTestId("consistency-summary")).toContainText("0 error(s)");
  const initial = page.getByLabel("Initial submission");
  if (!(await initial.isChecked())) await initial.check();
  await page.locator('input[name="resultsMeetRequirements"][value="Y"]').check();
  await page.getByRole("button", { name: "Sign PSW" }).click();
  // The post-sign refresh re-runs the consistency checks (many Neon round-trips) — allow for a slow wake.
  await expect(page.getByTestId("psw-signed")).toContainText("E-signed by Santhosh BG", { timeout: 90_000 });
  await expect(page.getByTestId("ppap-status")).toHaveText("Submitted");
}

/** Pack PDF (bookmarks in element order, N/A elements left out), ZIP (4 reference folders) and workbook (20 sheets). */
async function downloadPack(page: Page, ppapId: string) {
  await page.goto(`/ppap/${ppapId}/pack`);
  const rows = page.getByTestId("pack-row");
  await expect(rows.first()).toContainText("0. PPAP Checklist");
  const included = await rows.count();

  const pdfRes = await page.request.get(`/api/ppap/${ppapId}/pack?format=pdf`, { timeout: 600_000 });
  expect(pdfRes.status()).toBe(200);
  const pdf = await PDFDocument.load(await pdfRes.body());
  const titles = readOutlineTitles(pdf);
  expect(titles).toHaveLength(included);
  expect(titles[0]).toBe("0. PPAP Checklist");
  expect(titles.at(-1)).toBe("18. Part Submission Warrant (PSW)");
  const nos = titles.map((t) => Number(t.split(".")[0]));
  expect(nos).toEqual([...nos].sort((a, b) => a - b));
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(included);

  const zipRes = await page.request.get(`/api/ppap/${ppapId}/pack?format=zip`, { timeout: 600_000 });
  expect(zipRes.status()).toBe(200);
  const zip = await JSZip.loadAsync(await zipRes.body());
  const names = Object.keys(zip.files);
  for (const folder of ["Drawing & Engineering/", "Manufacturing Process & Risk/", "Inspection & Testing/", "Validation & Approval/"]) {
    expect(names.some((n) => n.startsWith(folder))).toBe(true);
  }
  expect(names).toContain("00 PPAP Checklist.pdf");
  expect(names).toContain("PPAP Workbook.xlsx");
  expect(names.some((n) => n.endsWith(" - pack.pdf"))).toBe(true);
  expect(names.filter((n) => n.endsWith(".pdf") && !n.includes("attachments") && !n.endsWith(" - pack.pdf"))).toHaveLength(included);
}

test("Full flow, supplier-upload mode: clone seed → approve all → sign PSW → customer approval from signed copy → pack downloads", async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const partNo = `E2E-FLOW-U-${Date.now()}`;
  const ppapId = await cloneSeed(page, "E2E Flow Upload Customer", partNo, "SUPPLIER_UPLOAD");

  await completeAndSign(page, ppapId);

  // Dashboard: upload mode is waiting on the signed copy.
  await page.goto("/");
  await expect(pswDecision(page, partNo)).toContainText("Signed copy missing (upload)");

  await page.goto(`/ppap/${ppapId}/18`);
  await page.locator("#cd-status").selectOption("APPROVED");
  await page.locator("#cd-customer-name").fill("Jane Customer");
  await page.setInputFiles("#cd-file", { name: "psw-signed.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 signed") });
  await page.getByRole("button", { name: "Save disposition" }).click();
  await expect(page.getByTestId("ppap-status")).toHaveText("Closed", { timeout: 30_000 });

  await page.goto("/");
  await expect(page.getByTestId("ppap-row").filter({ hasText: partNo })).toContainText("Closed");
  await expect(pswDecision(page, partNo)).toHaveCount(0);

  // Audit viewer shows this PPAP's sign-offs and the disposition.
  await page.goto(`/audit?ppap=${ppapId}`);
  await expect(page.getByTestId("audit-row").first()).toBeVisible();
  expect(await page.getByTestId("audit-row").count()).toBeGreaterThan(5);

  await downloadPack(page, ppapId);
});

test("Full flow, customer-portal mode: approver login is scoped and read-only, approves the PSW, pack downloads", async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const customer = "E2E Flow Portal Customer";
  const partNo = `E2E-FLOW-P-${Date.now()}`;
  const ppapId = await cloneSeed(page, customer, partNo, "CUSTOMER_PORTAL");

  await completeAndSign(page, ppapId);
  await expect(page.getByText(/Read-only — only that customer's approver/)).toBeVisible();
  await page.goto("/");
  await expect(pswDecision(page, partNo)).toContainText("Awaiting customer (portal)");

  const approver = `e2e-approver-${Date.now()}@customer.example`;
  execFileSync(process.execPath, [tsxCli(), "scripts/create-e2e-approver.ts", customer, approver], { stdio: "inherit" });

  await logout(page);
  await login(page, approver);

  // Permissions: own customer only, no supplier masters / users / audit log.
  await expect(page.getByTestId("ppap-row")).toHaveCount(1);
  await expect(page.getByTestId("ppap-row")).toContainText(partNo);
  const nav = page.getByRole("navigation");
  for (const item of ["Users", "Instruments", "Labs", "Audit log"]) await expect(nav.getByRole("link", { name: item, exact: true })).toHaveCount(0);
  // Guards call notFound(): a real 404 (they sit outside every loading.tsx boundary) and none of the guarded content.
  for (const url of ["/audit", "/users", "/instruments", `/ppap/${SEED}/0`, `/ppap/${ppapId}/clone`]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(404);
    await expect(page.getByTestId("not-found"), url).toBeVisible();
  }
  await page.goto("/audit");
  await expect(page.getByTestId("audit-row")).toHaveCount(0);
  await page.goto(`/ppap/${SEED}/0`);
  await expect(page.getByText("Chassis Brut, NBL Raw Frame, NBL")).toHaveCount(0);
  expect((await page.request.get(`/api/ppap/${SEED}/pack?format=xlsx`)).status()).toBe(404);

  // Supplier data is read-only for the approver.
  await page.goto(`/ppap/${ppapId}/9`);
  await page.getByRole("button", { name: "Revise" }).click();
  await page.getByPlaceholder("Reason for revision").fill("customer try");
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByTestId("signature-error")).toHaveText("Customer logins are read-only here — only the customer disposition can be recorded.");

  await page.goto("/");
  await expect(page.getByTestId("customer-decisions")).toContainText("Awaiting your decision");
  await page.goto(`/ppap/${ppapId}/18`);
  await page.locator("#cd-status").selectOption("APPROVED");
  await page.locator("#cd-customer-name").fill("E2E Customer Approver");
  await page.getByRole("button", { name: "Save disposition" }).click();
  await expect(page.getByTestId("ppap-status")).toHaveText("Closed", { timeout: 30_000 });

  // The customer can download its own pack.
  await downloadPack(page, ppapId);
});
