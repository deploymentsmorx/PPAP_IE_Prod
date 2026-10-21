import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { PDFDocument } from "pdf-lib";
import { readOutlineTitles } from "../lib/pdf-outline";

// Final PPAP by submission level (pack page): the download appears once a
// level is confirmed, and its PDF has the PSW as sheet 1 followed by that
// level's sheets. Runs on a clone of the seed (the seed is never modified).

const SEED = "seed-ppap-1170750-raw-h";

test.afterAll(() => {
  execFileSync(process.execPath, [require.resolve("tsx/cli"), "scripts/cleanup-e2e.ts"], { stdio: "inherit" });
});

async function finalPdfTitles(page: Page, ppapId: string) {
  const res = await page.request.get(`/api/ppap/${ppapId}/pack?format=pdf&set=final`, { timeout: 600_000 });
  expect(res.status()).toBe(200);
  return readOutlineTitles(await PDFDocument.load(await res.body()));
}

test("Final PPAP: choose level 2 with picked documents, then level 1 — PSW first", async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto(`/ppap/${SEED}/clone`);
  await page.getByLabel("A new part").check();
  await page.getByLabel("New customer").check();
  await page.getByLabel("New customer name").fill("E2E Submission Level Customer");
  await page.getByLabel("Part number").fill(`E2E-LEVEL-${Date.now()}`);
  await page.getByLabel("Revision letter").fill("A");
  await page.getByRole("button", { name: "Clone PPAP" }).click();
  await page.waitForURL(/\/ppap\/(?!seed-)[^/]+\/0$/, { timeout: 180_000 });
  const ppapId = new URL(page.url()).pathname.match(/^\/ppap\/([^/]+)/)![1];

  await page.goto(`/ppap/${ppapId}/pack`);
  const card = page.getByTestId("submission-level");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("final-pdf")).toHaveCount(0);
  expect((await page.request.get(`/api/ppap/${ppapId}/pack?format=pdf&set=final`)).status()).toBe(409);

  // Level 2: pick two supporting documents.
  await card.getByLabel(/^Level 2:/).check();
  const boxes = page.getByTestId("submission-picks").locator("input:not([disabled])");
  await boxes.nth(3).check();
  await boxes.nth(1).check();
  const order = page.getByTestId("submission-order").locator("li");
  await expect(order).toHaveCount(3);
  await expect(order.first()).toHaveText("18. Part Submission Warrant (PSW)");
  const expected = await order.allTextContents();

  await card.getByRole("button", { name: "Confirm Level 2" }).click();
  await expect(page.getByTestId("final-pdf")).toHaveText("Download final PPAP (Level 2) PDF", { timeout: 30_000 });
  const titles = await finalPdfTitles(page, ppapId);
  expect(titles).toEqual(expected);
  const rest = titles.slice(1).map((t) => Number(t.split(".")[0]));
  expect(rest).toEqual([...rest].sort((a, b) => a - b));

  // The PPAP's level follows the choice (ticked on the PSW, shown in the header).
  await page.reload();
  await expect(page.getByText("Level 2", { exact: true })).toBeVisible();

  // Changing the choice hides the download until it is confirmed again.
  await card.getByLabel(/^Level 1:/).check();
  await expect(page.getByTestId("final-pdf")).toHaveCount(0);
  await expect(page.getByTestId("submission-picks")).toHaveCount(0);
  await card.getByRole("button", { name: "Confirm Level 1" }).click();
  await expect(page.getByTestId("final-pdf")).toBeVisible({ timeout: 30_000 });
  expect(await finalPdfTitles(page, ppapId)).toEqual(await order.allTextContents());
  expect((await order.allTextContents())[0]).toBe("18. Part Submission Warrant (PSW)");
});
