import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

test.afterAll(() => {
  const tsxCli = require.resolve("tsx/cli");
  execFileSync(process.execPath, [tsxCli, "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

test("Lab Reports: choosing E250 BR fills all limits, an out-of-limit Mn marks NG, an expired lab cannot be selected", async ({ page }) => {
  test.setTimeout(150_000);

  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/ppap/new");
  await page.getByText("New customer").click();
  await page.getByLabel("Customer name").fill("E2E Lab Test Customer");
  await page.getByText("New part").click();
  await page.getByLabel("Part name").fill("E2E Lab Test Part");
  await page.getByLabel("Part number").fill("E2E-LAB-001");
  await page.getByLabel("Revision letter").fill("H");
  await page.getByLabel("Drawing number").fill("DWG-E2E-LAB-001");
  await page.getByRole("button", { name: "Create PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!new$)[^/]+(\/\d+)?$/, { timeout: 20_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/12`);
  await expect(page.getByRole("main").getByText("12. Lab Reports")).toBeVisible();

  // --- An expired lab cannot be selected ---
  await page.getByRole("button", { name: "+ Add Report" }).click();
  const labSelect = page.getByLabel("Lab");
  await expect(labSelect.locator("option", { hasText: "Expired Testing Services" })).toHaveAttribute("disabled", "");

  // --- Choosing E250 BR fills all limits ---
  await page.getByLabel("Material Grade", { exact: true }).selectOption({ label: "IS 2062 E250 BR" });
  await page.getByLabel("Lab").selectOption({ label: "Bureau Veritas Metallurgical Lab" });
  await page.getByLabel("Report No.").fill("LAB-E2E-001");
  await page.getByRole("button", { name: "Create Report" }).click();
  await expect(page.getByText("LAB-E2E-001")).toBeVisible({ timeout: 20_000 });

  await expect(page.getByRole("cell", { name: "Min 250" })).toBeVisible(); // Yield Strength
  await expect(page.getByRole("cell", { name: "410-540" })).toBeVisible(); // UTS
  await expect(page.getByRole("cell", { name: "Min 23" })).toBeVisible(); // Elongation
  await expect(page.getByRole("cell", { name: "Min 27" })).toBeVisible(); // Impact

  // --- An out-of-limit Mn (max 1.5) marks NG ---
  await page.getByLabel("Mn result").fill("1.6");
  await page.getByLabel("Mn result").blur();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByLabel("Mn result")).toHaveClass(/border-red-500/, { timeout: 20_000 });
  await expect(page.getByText("NG", { exact: true }).first()).toBeVisible();

  // --- An in-limit chemical result stays OK ---
  await page.getByLabel("C result").fill("0.2");
  await page.getByLabel("C result").blur();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByLabel("C result")).not.toHaveClass(/border-red-500/);

  // --- Print view ---
  const printPage = await page.context().newPage();
  await printPage.goto(`/ppap/${ppapId}/12/print`);
  await expect(printPage.getByText("LAB REPORTS", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(printPage.getByText("Mn")).toBeVisible();
  await printPage.close();

  // --- Excel + PDF export ---
  const excelHref = await page.locator('a[href^="/api/lab/"]').getAttribute("href");
  const excel = await page.request.get(excelHref!);
  expect(excel.status()).toBe(200);
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");
  expect((await excel.body()).subarray(0, 2).toString()).toBe("PK"); // .xlsx is a zip

  const pdf = await page.request.get(`/api/ppap/${ppapId}/12/pdf`, { timeout: 60_000 });
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});
