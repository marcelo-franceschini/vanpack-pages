declare global {
  interface AnalyticsClientConfig {
    site: string;
    endpoint: string;
    host: string;
  }

  interface SiteClientConfig {
    whatsapp: string;
    analytics: AnalyticsClientConfig | null;
  }

  const __SITE__: SiteClientConfig;
}

export {};
