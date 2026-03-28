import { expect, test } from "@playwright/test";

test("home page renders core messaging and seo metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/M365 Tenant Reporter/);
  await expect(page.getByRole("heading", { name: /Premium Microsoft 365 reporting/i })).toBeVisible();
  await expect(page.locator("link[rel='canonical']")).toHaveCount(1);
});

test("app route is marked noindex", async ({ page }) => {
  await page.goto("/app");

  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  await expect(page.getByText(/Runtime configuration is still using placeholders/i)).toBeVisible();
});

test("blog routes render discoverable guidance content", async ({ page }) => {
  await page.goto("/blog");

  await expect(page).toHaveTitle(/M365 Tenant Reporter Blog/);
  await expect(page.getByRole("heading", { name: /Product guides that stay visually aligned/i })).toBeVisible();

  await page.getByRole("link", { name: /How to track total users in M365 Tenant Reporter/i }).click();

  await expect(page.locator("meta[property='article:published_time']")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/The total users metric is the first number/i)).toBeVisible();
});

test("static about and privacy pages render from dedicated routes", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveTitle(/About \| M365 Tenant Reporter/);
  await expect(page.getByRole("heading", { name: /A focused reporting product/i })).toBeVisible();

  await page.goto("/privacy");
  await expect(page).toHaveTitle(/Privacy \| M365 Tenant Reporter/);
  await expect(page.getByRole("heading", { name: /The application is built to minimize retained tenant data/i })).toBeVisible();
});
