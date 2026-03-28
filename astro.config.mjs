import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

const site = process.env.PUBLIC_SITE_URL ?? "https://m365report.cengizyilmaz.net";
const base = process.env.PUBLIC_BASE_PATH ?? "/";

export default defineConfig({
  site,
  base,
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"]
    }
  }
});
