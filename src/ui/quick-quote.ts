export interface QuickQuoteInput {
  model: string;
  print: string;
  dimensions: string;
  quantity: string;
}

/**
 * Pure WhatsApp message composer for the optional inline Quick-Quote Builder.
 * Always keeps copy concise, structured, and tagged with `[site-montador]` for attribution.
 */
export function buildQuickQuoteMessage(input: QuickQuoteInput): string {
  const model = input.model.trim() || 'Caixa de papelão';
  const print = input.print.trim();
  const dimensions = input.dimensions.trim();
  const quantity = input.quantity.trim();

  const details: string[] = [`Modelo: ${model}`];
  if (print) details.push(`Impressão: ${print}`);
  if (dimensions) details.push(`Medidas: ${dimensions} cm`);
  if (quantity) details.push(`Quantidade: ${quantity} un`);

  return `Olá! Gostaria de um orçamento: ${details.join(' · ')}. [site-montador]`;
}

/** Builds a clean `wa.me` link from the composed quote message. */
export function buildQuickQuoteUrl(whatsappNumber: string, input: QuickQuoteInput): string {
  const clean = whatsappNumber.replace(/\D/g, '');
  if (!clean) return '#orcamento';
  const msg = buildQuickQuoteMessage(input);
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
}

/** Wires live message preview and dynamic WhatsApp href updates on `#quick-quote`. */
export function mountQuickQuote(
  whatsappNumber: string,
  root: Document | HTMLElement = document,
): () => void {
  const container = root.querySelector<HTMLElement>('[data-quick-quote]');
  if (!container) return () => {};

  const modelEl = container.querySelector<HTMLSelectElement>('select[name="model"]');
  const printEl = container.querySelector<HTMLSelectElement>('select[name="print"]');
  const dimsEl = container.querySelector<HTMLInputElement>('input[name="dimensions"]');
  const qtyEl = container.querySelector<HTMLInputElement>('input[name="quantity"]');
  const previewEl = container.querySelector<HTMLElement>('[data-qq-preview]');
  const linkEl = container.querySelector<HTMLAnchorElement>('[data-qq-link]');

  const sync = () => {
    const input: QuickQuoteInput = {
      model: modelEl?.value ?? '',
      print: printEl?.value ?? '',
      dimensions: dimsEl?.value ?? '',
      quantity: qtyEl?.value ?? '',
    };
    const msg = buildQuickQuoteMessage(input);
    if (previewEl) {
      previewEl.textContent = `“${msg.replace(/\s*\[site-montador\]$/, '')}”`;
    }
    if (linkEl) {
      linkEl.href = buildQuickQuoteUrl(whatsappNumber, input);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement | null;
    if (target?.tagName === 'INPUT') {
      e.preventDefault();
      sync();
      linkEl?.click();
    }
  };

  container.addEventListener('input', sync);
  container.addEventListener('change', sync);
  container.addEventListener('keydown', onKeyDown);
  sync();

  return () => {
    container.removeEventListener('input', sync);
    container.removeEventListener('change', sync);
    container.removeEventListener('keydown', onKeyDown);
  };
}
