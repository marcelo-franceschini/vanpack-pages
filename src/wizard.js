// Assistente de orçamento: a variante B do experimento quote_wizard troca o CTA final por 3 passos
// (tipo de caixa, medidas e quantidade, impressão) que montam a mensagem do WhatsApp. Nada vai a um
// servidor e não há <form>: são controles soltos, com rótulo, teclado e validação no lugar. Só é
// montado na variante B (import dinâmico): a página estática não tem nenhum controle.
import { track } from './analytics.js';

const UNKNOWN = { id: 'nao-sei', label: 'Ainda não sei' };
const PRINT = [
  { id: 'nenhuma', label: 'Sem impressão' },
  { id: 'uma', label: 'Com a minha marca, uma cor' },
  { id: 'varias', label: 'Com a minha marca, mais de uma cor' },
  UNKNOWN,
];
const MAX_CM = 300;

/** Cria um elemento: atributos em `attrs` (false/null saem) e filhos em texto ou nós. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== false && value != null) node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children);
  return node;
}

const number = (text) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));
const show = (value) => String(Number(value)).replace('.', ',');

/**
 * @param {HTMLElement} section `#orcamento`
 * @param {{ models: { id: string, name: string }[] }} options
 */
export function mountQuoteWizard(section, { models }) {
  const original = section.querySelector('a[data-cta="orcamento"]');
  if (!original) return;
  const base = new URL(original.href);
  const wizard = el('div', { class: 'wizard', role: 'group', 'aria-label': 'Monte seu pedido' });
  // o assistente fica no lugar do texto, do botão e dos avisos do CTA final (que seguem no HTML)
  for (const node of section.querySelectorAll('.lead, a[data-cta="orcamento"], .cta-note, .alt')) {
    node.hidden = true;
  }
  section.querySelector('h2').after(wizard);

  const state = { tipo: '', semMedida: false, c: '', l: '', a: '', qtd: '', imp: '' };
  const types = [...models.map(({ id, name }) => ({ id, label: name })), UNKNOWN];
  let step = 1;
  let error;

  const radios = (name, options, current) =>
    options.map(({ id, label }) =>
      el(
        'label',
        { class: 'wiz-opt' },
        el('input', { type: 'radio', name, value: id, checked: id === current }),
        el('span', {}, label),
      ),
    );

  function field(label, key, attrs) {
    const input = el('input', {
      type: 'number',
      inputmode: 'decimal',
      min: '1',
      step: 'any',
      value: state[key],
      disabled: state.semMedida && ['c', 'l', 'a'].includes(key),
      ...attrs,
    });
    input.addEventListener('input', () => (state[key] = input.value));
    return el('label', { class: 'wiz-field' }, el('span', {}, label), input);
  }

  function content() {
    if (step === 1) {
      return [el('legend', {}, 'Qual caixa você quer?'), ...radios('tipo', types, state.tipo)];
    }
    if (step === 2) {
      const unknown = el('input', { type: 'checkbox', checked: state.semMedida });
      unknown.addEventListener('change', () => {
        state.semMedida = unknown.checked;
        for (const input of wizard.querySelectorAll('[data-medida]'))
          input.disabled = unknown.checked;
      });
      return [
        el('legend', {}, 'Medidas e quantidade'),
        field('Comprimento (cm)', 'c', { 'data-medida': '', max: String(MAX_CM) }),
        field('Largura (cm)', 'l', { 'data-medida': '', max: String(MAX_CM) }),
        field('Altura (cm)', 'a', { 'data-medida': '', max: String(MAX_CM) }),
        el('label', { class: 'wiz-opt' }, unknown, el('span', {}, 'Ainda não sei as medidas')),
        field('Quantidade de caixas', 'qtd', { inputmode: 'numeric', step: '1' }),
      ];
    }
    return [el('legend', {}, 'Vai ter a sua marca impressa?'), ...radios('imp', PRINT, state.imp)];
  }

  function message() {
    const tipo = types.find(({ id }) => id === state.tipo).label;
    const medida = state.semMedida
      ? 'preciso de ajuda para medir'
      : `${show(state.c)} x ${show(state.l)} x ${show(state.a)} cm`;
    const impressao = PRINT.find(({ id }) => id === state.imp).label;
    return (
      'Olá! Quero um orçamento de caixas de papelão. ' +
      `Caixa: ${tipo} · Medida (C x L x A): ${medida} · Quantidade: ${show(state.qtd)} · ` +
      `Impressão: ${impressao} [site-orcamento-assistente]`
    );
  }

  /** Mensagem de erro do passo atual, ou '' se está tudo certo (e marca o campo com problema). */
  function problem() {
    const invalid = (input) => input.setAttribute('aria-invalid', 'true');
    for (const input of wizard.querySelectorAll('[aria-invalid]'))
      input.removeAttribute('aria-invalid');
    if (step === 1 && !state.tipo) return 'Escolha um tipo de caixa para continuar.';
    if (step === 3 && !state.imp) return 'Diga se a caixa vai ter a sua marca impressa.';
    if (step !== 2) return '';
    if (!state.semMedida) {
      const bad = [...wizard.querySelectorAll('[data-medida]')].filter((input) => {
        const value = number(input.value);
        return !(value > 0 && value <= MAX_CM);
      });
      if (bad.length) {
        bad.forEach(invalid);
        bad[0].focus();
        return `Informe comprimento, largura e altura em centímetros, de 1 a ${MAX_CM}, ou marque que ainda não sabe.`;
      }
    }
    const qtd = number(state.qtd);
    if (!(Number.isInteger(qtd) && qtd >= 1)) {
      const input = wizard.querySelector('input:not([data-medida]):not([type=checkbox])');
      invalid(input);
      input.focus();
      return 'Informe a quantidade de caixas (um número inteiro, de 1 em diante).';
    }
    return '';
  }

  function go(next, { focus = true } = {}) {
    step = next;
    const done = step === 4;
    const legend = done ? 'Confira e envie' : null;
    const body = el('div', { class: 'wiz-step', tabindex: '-1' });
    if (done) {
      const line = (label, value) => el('li', {}, el('b', {}, label), value);
      const tipo = types.find(({ id }) => id === state.tipo).label;
      const medida = state.semMedida
        ? 'Preciso de ajuda para medir'
        : `${show(state.c)} x ${show(state.l)} x ${show(state.a)} cm`;
      const link = el('a', {
        class: 'btn btn-light',
        'data-cta': 'orcamento-assistente',
        target: '_blank',
        rel: 'noopener',
        href: `${base.origin}${base.pathname}?text=${encodeURIComponent(message())}`,
      });
      link.innerHTML =
        '<svg aria-hidden="true"><use href="#i-wa" /></svg>Pedir orçamento no WhatsApp';
      body.append(
        el('h3', { class: 'wiz-title' }, legend),
        el(
          'ul',
          { class: 'wiz-sum' },
          line('Caixa', tipo),
          line('Medida', medida),
          line('Quantidade', show(state.qtd)),
          line('Impressão', PRINT.find(({ id }) => id === state.imp).label),
        ),
        link,
      );
    } else {
      body.append(el('fieldset', {}, ...content()));
    }
    error = el('p', { class: 'wiz-error', role: 'alert' });
    const nav = el('div', { class: 'wiz-nav' });
    if (step > 1) {
      const back = el('button', { class: 'btn btn-soft', type: 'button' }, 'Voltar');
      back.addEventListener('click', () => go(step - 1));
      nav.append(back);
    }
    if (!done) {
      const next = el(
        'button',
        { class: 'btn btn-light', type: 'button' },
        step === 3 ? 'Ver mensagem' : 'Próximo',
      );
      next.addEventListener('click', advance);
      nav.append(next);
    }
    wizard.replaceChildren(
      el('p', { class: 'wiz-progress' }, done ? 'Pronto' : `Passo ${step} de 3`),
      body,
      error,
      nav,
    );
    body.setAttribute('aria-label', done ? 'Pronto: confira e envie' : `Passo ${step} de 3`);
    if (focus) body.focus();
    track('wizard_step', { step });
  }

  function advance() {
    const message = problem();
    error.textContent = message;
    if (!message) go(step + 1);
  }

  // Enter num campo avança, como num formulário (que não existe aqui)
  wizard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches?.('input')) {
      e.preventDefault();
      advance();
    }
  });
  wizard.addEventListener('change', (e) => {
    if (e.target.matches?.('input[type=radio]')) {
      state[e.target.name] = e.target.value;
      error.textContent = '';
    }
  });

  go(1, { focus: false });
}
