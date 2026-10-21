// Tipos globais do que o Vite injeta (define) no navegador.
declare const __SITE__: {
  experiments: Record<
    string,
    { enabled: boolean; variants: string[]; split: number[]; endsAt: string }
  >;
  models: { id: string; name: string }[];
  analytics: { site: string; endpoint: string; host: string } | null;
};
interface ImportMeta {
  readonly env: { readonly MODE: string };
}
interface Window {
  dataLayer: Record<string, unknown>[];
  /** Só no build de auditoria: contadores e ganchos de teste (src/render e src/produtos). */
  __audit?: any;
}
interface Navigator {
  connection?: { saveData?: boolean; effectiveType?: string };
  deviceMemory?: number;
}
