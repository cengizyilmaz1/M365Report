import sharedSiteConfig from "../../shared/site.config.json";

export interface SiteLink {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
  tone?: "primary" | "secondary" | "ghost";
}

export interface FooterLinkGroup {
  title: string;
  links: SiteLink[];
}

interface SiteConfigShape {
  siteConfig: {
    name: string;
    shortName: string;
    domain: string;
    siteUrl: string;
    loginPath: string;
    appPath: string;
    blogPath: string;
    docsPath: string;
    aboutPath: string;
    privacyPath: string;
    authorName: string;
    authorUrl: string;
    defaultDescription: string;
    defaultKeywords: string[];
    socialHandle: string;
  };
  siteNavigation: SiteLink[];
  headerActions: SiteLink[];
  ecosystemLinks: SiteLink[];
  socialLinks: SiteLink[];
  footerLinkGroups: FooterLinkGroup[];
}

const siteData = sharedSiteConfig as SiteConfigShape;

export const siteConfig = siteData.siteConfig;
export const siteNavigation = siteData.siteNavigation;
export const headerActions = siteData.headerActions;
export const ecosystemLinks = siteData.ecosystemLinks;
export const socialLinks = siteData.socialLinks;
export const footerLinkGroups = siteData.footerLinkGroups;
export const organizationProfiles = socialLinks.map((link) => link.href);
