// "O WhatsApp não abriu?": depois do toque num botão do WhatsApp a página deveria sair de vista (o app
// abre por cima, ou o wa.me abre em outra aba). Se ela continua à vista HANDOFF_MS depois, o WhatsApp
// provavelmente não abriu (navegador embutido de rede social, app ausente, aba bloqueada) e sobe a
// folha #zap-ajuda com o número para copiar e o telefone. Sem cookie e sem storage.

const HANDOFF_MS = 2500;

// Navegadores embutidos de redes sociais, pelo user agent (o do Instagram vem antes).
/** @type {[string, RegExp][]} */
const IN_APP = [
  ['ig', /Instagram/],
  ['fb', /FBAN|FBAV|FB_IAB/], // Facebook e Messenger
  ['tt', /TikTok|musical_ly|BytedanceWebview/],
];

/** 'ig' (Instagram), 'fb' (Facebook ou Messenger), 'tt' (TikTok) ou '' (navegador comum). */
export function inAppBrowser(userAgent = globalThis.navigator?.userAgent ?? '') {
  return IN_APP.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? '';
}

/**
 * Liga a folha de ajuda aos botões do WhatsApp.
 * @param {object} options
 * @param {HTMLElement | null} options.sheet a folha (#zap-ajuda), que vem com `hidden`
 * @param {string} options.inapp navegador embutido (inAppBrowser()): mostra como sair dele
 * @param {(event: string, data: object) => void} [options.onEvent] medição
 */
export function createHandoff({ sheet, inapp, onEvent }) {
  if (!sheet) return { watch() {} };
  const title = /** @type {HTMLElement} */ (sheet.querySelector('.sheet-t'));
  const status = /** @type {HTMLElement} */ (sheet.querySelector('.sheet-status'));
  const number = /** @type {HTMLElement} */ (sheet.querySelector('.sheet-num'));
  const copy = /** @type {HTMLElement} */ (sheet.querySelector('[data-copy]'));
  /** @type {HTMLElement} */ (sheet.querySelector('.sheet-inapp')).hidden = !inapp;

  let timer = 0;
  let opener = null; // botão que abriu a folha: o foco volta para ele

  function open(link) {
    opener = link;
    status.textContent = '';
    sheet.hidden = false;
    title.focus();
  }

  function close({ refocus = true } = {}) {
    if (sheet.hidden) return;
    sheet.hidden = true;
    if (refocus && opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }

  // A página saiu de vista: o WhatsApp abriu (ou a pessoa foi para outra aba ou app). Não houve
  // falha, e a folha que já tinha subido (o app demorou a abrir) fecha sozinha.
  function left() {
    clearTimeout(timer);
    close({ refocus: false });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') left();
  });
  addEventListener('pagehide', left);

  async function copyNumber() {
    let ok;
    try {
      await navigator.clipboard.writeText(copy.dataset.copy);
      ok = true;
    } catch {
      // sem a API (navegador antigo ou embutido): seleciona o número, que fica pronto para copiar
      const range = document.createRange();
      range.selectNodeContents(number);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      ok = document.execCommand('copy');
    }
    status.textContent = ok ? 'Número copiado.' : 'Toque e segure o número para copiar.';
    onEvent?.('whatsapp_copy', { ok });
  }

  copy?.addEventListener('click', copyNumber);
  sheet.querySelector('.sheet-x').addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) close();
  });

  return {
    /** No clique de um botão do WhatsApp, antes de o navegador seguir o link. */
    watch(link, e) {
      // aba de fundo de propósito (Ctrl, Cmd, Shift, Alt) ou link que outro código já segurou
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (e.defaultPrevented) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === 'hidden') return;
        onEvent?.('handoff_fail', { cta: link.dataset.cta });
        open(link);
      }, HANDOFF_MS);
    },
  };
}
