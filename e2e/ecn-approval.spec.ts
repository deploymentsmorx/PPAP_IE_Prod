import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("approving an ECN creates the next revision and flags affected elements", async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  // --- Create a fresh PPAP at revision H so the next revision is deterministic ---
  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E ECN Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E ECN Test Part");
  await page.getByLabel("Part number").fill("E2E-ECN-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-ECN-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  // --- Element 2 starts REQUIRED (not N/A) for a fresh PPAP, so the ECN log is already visible ---
  await page.goto(`/ppap/${ppapId}/2`);
  await expect(page.getByRole("button", { name: "Add ECN" })).toBeVisible();

  await page.getByRole("button", { name: "Add ECN" }).click();
  await page.waitForURL(/\/2\/new$/);

  await page.getByLabel("ECN Number").fill("ECN-TEST-001");
  await page.getByLabel("Type of Change").selectOption("DESIGN");
  // Role-based targeting avoids the ambiguity with the left-nav link,
  // which has the same visible text as these checkbox labels.
  await page.getByRole("checkbox", { name: "6. Process FMEA (PFMEA)" }).check();
  await page.getByRole("checkbox", { name: "7. Control Plan" }).check();

  await page.locator("#ecn-approved-by").selectOption({ label: "Rajesh Goel" });
  await page.locator("#ecn-approved-at").fill("2026-02-01");

  await page.getByRole("button", { name: "Save ECN" }).click();
  // Wait for content only the saved detail page shows (not "/2/new"'s form),
  // rather than matching on URL shape — "/2/new" would also satisfy a loose
  // "/2/<something>" pattern while the navigation is still in flight.
  await expect(page.getByText("ECN ECN-TEST-001")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Approved — created Rev\. I/)).toBeVisible();

  // --- Clone PPAP to the new revision ---
  await page.getByRole("button", { name: "Clone PPAP to new revision" }).click();
  // This redirects to /ppap/[newId], which itself redirects to /ppap/[newId]/0 —
  // wait for the final hop so the id we extract isn't read mid-transition.
  await page.waitForURL(/\/ppap\/[^/]+\/\d+$/, { timeout: 20_000 });
  const newPpapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];
  expect(newPpapId).not.toBe(ppapId);

  // --- Original PPAP's nav shows PFMEA + Control Plan flagged ---
  await page.goto(`/ppap/${ppapId}/1`);
  const pfmeaRow = page.getByRole("link", { name: /Process FMEA \(PFMEA\)/ });
  const controlPlanRow = page.getByRole("link", { name: /^7\. Control Plan/ });
  await expect(pfmeaRow.getByText("Revision required")).toBeVisible();
  await expect(controlPlanRow.getByText("Revision required")).toBeVisible();
});
