import type { APIRoute } from "astro";
import { siteConfig } from "@/lib/site";

export const GET: APIRoute = ({ site }) => {
  const baseUrl = site?.toString().replace(/\/+$/, "") ?? siteConfig.siteUrl;
  const basePath = import.meta.env.BASE_URL ?? "/";
  const sitemapUrl = new URL("sitemap-index.xml", new URL(basePath, `${baseUrl}/`)).toString();
  const blogSitemapUrl = new URL("blog/sitemap.xml", `${baseUrl}/`).toString();

  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\nSitemap: ${blogSitemapUrl}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
};
