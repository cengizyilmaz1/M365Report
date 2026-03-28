import rawGuides from "../../shared/blog-guides.json";

export interface GuideSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingTime: string;
  publishedAt: string;
  featured?: boolean;
}

export const guideCatalog = rawGuides as GuideSummary[];
export const featuredGuides = guideCatalog.filter((guide) => guide.featured);
