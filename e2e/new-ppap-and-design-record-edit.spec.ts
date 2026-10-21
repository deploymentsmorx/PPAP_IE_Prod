import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  // This test creates a real customer/part/PPAP via the UI; clean it up so
  // repeated runs don't accumulate junk in the shared development database.
  // Run as a separate process (not an in-process import) because the
  // generated Prisma client uses import.meta, which Playwright's test
  // runner (CJS-transpiled) can't execute directly. Resolve tsx's CLI
  // script and invoke it with the current Node binary directly — avoids
  // npx/.cmd-shim spawning issues on Windows.
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

test("creates a new PPAP end-to-end, then edits every part of Design Record", async ({ page }) => {
  // This test performs several round trips (login, create, multiple saves)
  // against PostgreSQL, whose hosted compute can cold-start on any of them.
  test.setTimeout(90_000);
  await login(page);

  // --- Create a new PPAP (new customer, new part, new revision) ---
  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E Test Customer");

  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E Test Part");
  await page.getByLabel("Part number").fill("E2E-001");

  await page.getByLabel("Revision letter").fill("A");
  await page.getByLabel("Drawing number").fill("DWG-E2E-001");

  await page.getByRole("button", { name: "Create PPAP" }).click();
  // The server action redirects to /ppap/[id], which itself redirects to
  // /ppap/[id]/0 — wait for either and extract the id by regex rather than
  // a naive split, since the URL may have already moved on by this point.
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/\/ppap\/([^/]+)/)![1];
  await page.goto(`/ppap/${ppapId}/1`);
  await expect(page.getByRole("main").getByText("1. Design Records")).toBeVisible();

  // --- Edit master fields (write-through to Part/Customer/PartRevision) ---
  const partNameInput = page.locator('input[name="partName"]');
  await expect(partNameInput).toHaveValue("E2E Test Part");
  await partNameInput.fill("E2E Test Part (Renamed)");
  await page.getByRole("button", { name: "Save" }).first().click();
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator('input[name="partName"]')).toHaveValue("E2E Test Part (Renamed)");

  // --- Special Characteristics: add, edit, delete ---
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByLabel("Characteristic").fill("Bore diameter");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Bore diameter")).toBeVisible();

  await page.getByRole("row", { name: /Bore diameter/ }).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Characteristic").fill("Bore diameter (edited)");
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.getByText("Bore diameter (edited)")).toBeVisible();

  await page.getByRole("row", { name: /Bore diameter \(edited\)/ }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Bore diameter (edited)")).not.toBeVisible();

  // --- Balloons: add, edit, delete ---
  await page.getByRole("button", { name: "Add balloon" }).click();
  await page.getByLabel("Description").fill("Overall length");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Overall length")).toBeVisible();

  await page.getByRole("row", { name: /Overall length/ }).getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Description").fill("Overall length (edited)");
  await page.getByRole("button", { name: "Save", exact: true }).last().click();
  await expect(page.getByText("Overall length (edited)")).toBeVisible();

  await page.getByRole("row", { name: /Overall length \(edited\)/ }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Overall length (edited)")).not.toBeVisible();
});
