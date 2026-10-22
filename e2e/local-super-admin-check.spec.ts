import { expect, test } from "@playwright/test";

test("local Super Admin can sign in and open Super Admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@smorx.ai");
  await page.getByLabel("Password", { exact: true }).fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");

  await page.goto("/super-admin");
  await expect(page.getByRole("heading", { name: "Super Admin", exact: true })).toBeVisible();
});