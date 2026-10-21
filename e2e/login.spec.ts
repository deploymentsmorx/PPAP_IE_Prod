import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("PPAP Management — Ingenious Engineering Pvt Ltd")).toBeVisible();
});

test("signs in with seeded credentials and sees the PPAP list", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("santhosh.bg@ingenious-engineering.local");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByText("Chassis Brut, NBL Raw Frame, NBL")).toBeVisible();

  await page.getByText("Chassis Brut, NBL Raw Frame, NBL").click();
  await expect(page).toHaveURL(/\/ppap\/.+\/0$/);
  await expect(page.getByRole("main").getByText("0. PPAP Checklist")).toBeVisible();
});
