import { expect, test } from "@playwright/test";

test("home page renders core messaging and seo metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/M365 Tenant Reporter/);
  await expect(page.getByRole("heading", { name: /Microsoft 365 usage, license/i })).toBeVisible();
  await expect(page.locator("link[rel='canonical']")).toHaveCount(1);
});

test("app route is marked noindex", async ({ page }) => {
  await page.goto("/app");

  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
});

test("blog routes render discoverable guidance content", async ({ page }) => {
  await page.goto("/blog");

  await expect(page).toHaveTitle(/Blog \| M365 Tenant Reporter/);
  await expect(page.getByRole("heading", { name: /Learn how each report module works/i })).toBeVisible();

  await page.getByRole("link", { name: /How to track total users in M365 Tenant Reporter/i }).click();

  await expect(page.locator("meta[property='article:published_time']")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/The total users metric is the first number/i)).toBeVisible();
});

test("static about and privacy pages render from dedicated routes", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveTitle(/About \| M365 Tenant Reporter/);
  await expect(page.getByRole("heading", { name: /Microsoft 365 insights platform/i })).toBeVisible();

  await page.goto("/privacy");
  await expect(page).toHaveTitle(/Privacy \| M365 Tenant Reporter/);
  await expect(page.getByRole("heading", { name: /Your tenant data never leaves the browser/i })).toBeVisible();
});
