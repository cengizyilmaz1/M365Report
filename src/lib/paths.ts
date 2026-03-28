export function withBase(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path === "/" ? "" : path.replace(/^\/+/, "");

  return `${normalizedBase}${normalizedPath}`.replace(/\/{2,}/g, "/");
}

export function withBaseOrigin(siteUrl: string, basePath: string, path: string) {
  const baseUrl = new URL(basePath.endsWith("/") ? basePath : `${basePath}/`, `${siteUrl}/`);
  return new URL(path.replace(/^\/+/, ""), baseUrl).toString();
}

export function resolveHref(link: { href: string; external?: boolean }) {
  return link.external ? link.href : withBase(link.href);
}
