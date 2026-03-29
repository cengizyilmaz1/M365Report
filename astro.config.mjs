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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            if (id.includes("xlsx")) return "vendor-xlsx";
            if (id.includes("recharts")) return "vendor-charts";
            if (id.includes("@tanstack")) return "vendor-data";
            if (id.includes("@azure/msal-browser")) return "vendor-auth";
            if (id.includes("@radix-ui")) return "vendor-ui";
            return "vendor";
          }
        }
      }
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"]
    }
  }
});
