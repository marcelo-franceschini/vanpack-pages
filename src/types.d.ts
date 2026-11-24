interface AnalyticsClientConfig {
  site: string;
  endpoint: string;
  host: string;
}

interface SiteClientConfig {
  whatsapp: string;
  analytics: AnalyticsClientConfig | null;
}

declare const __SITE__: SiteClientConfig;
