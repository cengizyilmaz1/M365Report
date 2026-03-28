import type { CollectionEntry } from "astro:content";

export type BlogEntry = CollectionEntry<"blog">;

export interface BlogSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingTime: string;
  publishedAt: string;
  publishedDateIso: string;
  featured: boolean;
}

const datedSlugPattern = /^(?<date>\d{4}-\d{2}-\d{2})-(?<slug>.+)$/;

export function getBlogSlug(id: string) {
  return id.match(datedSlugPattern)?.groups?.slug ?? id;
}

export function getBlogDateIso(id: string) {
  return id.match(datedSlugPattern)?.groups?.date ?? new Date().toISOString().slice(0, 10);
}

export function formatBlogDate(dateIso: string) {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function sortBlogEntries(entries: BlogEntry[]) {
  return [...entries].sort((left, right) => getBlogDateIso(right.id).localeCompare(getBlogDateIso(left.id)));
}

export function toBlogSummary(entry: BlogEntry): BlogSummary {
  const publishedDateIso = getBlogDateIso(entry.id);

  return {
    slug: getBlogSlug(entry.id),
    title: entry.data.title,
    excerpt: entry.data.description,
    category: entry.data.category,
    readingTime: entry.data.reading_time,
    publishedAt: formatBlogDate(publishedDateIso),
    publishedDateIso,
    featured: entry.data.featured ?? false
  };
}
