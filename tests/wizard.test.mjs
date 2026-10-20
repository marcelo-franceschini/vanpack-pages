// Assistente de orçamento (variante B do experimento quote_wizard): 3 passos que montam a mensagem do
// WhatsApp, sem <form>, com rótulos, teclado e validação no lugar. A variante A (a página como está)
// não tem nenhum controle. A variante B é forçada por ?exp_quote_wizard=B.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, startServer } from '../scripts/lib.mjs';

let server;
let browser;
before(async () => {
  server = await startServer('dist');
  browser = await launch();
});
after(async () => {
  await browser.close();
  await server.close();
});

const open = async (query = '', options = {}) => {
  const opened = await openPage(browser, `${server.url}?tour=0${query}`, {
    reducedMotion: 'reduce',
    ...options,
  });
  // o link final do WhatsApp não pode tirar a página do lugar durante o teste
  await opened.page.evaluate(() =>
    document.addEventListener('click', (e) => e.target.closest('a') && e.preventDefault(), true),
  );
  await opened.page.evaluate(() => document.querySelector('#orcamento').scrollIntoView());
  return opened;
};
const B = '&exp_quote_wizard=B';

/** Percorre os 3 passos até a mensagem pronta. */
async function fill(page, { medida = true } = {}) {
  await page.locator('.wizard').getByText('Corte e vinco', { exact: true }).click();
  await page.locator('.wizard').getByRole('button', { name: 'Próximo' }).click();
  if (medida) {
    await page.getByLabel('Comprimento (cm)').fill('30');
    await page.getByLabel('Largura (cm)').fill('20');
    await page.getByLabel('Altura (cm)').fill('15');
  } else {
    await page.getByLabel('Ainda não sei as medidas').check();
  }
  await page.getByLabel('Quantidade', { exact: true }).fill('500');
  await page.keyboard.press('Enter'); // Enter avança, como num formulário
  await page.locator('.wizard').getByText('Com a minha marca, uma cor').click();
  await page.getByRole('button', { name: 'Ver mensagem' }).click();
}

describe('variante A (a página como está)', () => {
  test('o CTA final segue intacto e a página não tem nenhum controle de formulário', async () => {
    const { page, context } = await open();
    assert.equal(await page.locator('.wizard').count(), 0);
    assert.equal(await page.locator('form, input, select, textarea').count(), 0);
    assert.equal(await page.locator('#orcamento a[data-cta="orcamento"]').isVisible(), true);
    assert.equal(
      await page.evaluate(() => 'exp_quote_wizard' in document.documentElement.dataset),
      false,
    );
    const layer = await page.evaluate(() =>
      window.dataLayer.map((item) => Object.keys(item)).flat(),
    );
    assert.ok(
      !layer.includes('exp_quote_wizard'),
      'sem experimento ligado, nenhum evento leva a marca',
    );
    await context.close();
  });
});

describe('variante B (assistente de 3 passos)', () => {
  test('troca o CTA final pelo assistente e marca o <html> e os eventos', async () => {
    const { page, context } = await open(B);
    await page.waitForSelector('.wizard');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.exp_quote_wizard), 'B');
    assert.equal(await page.locator('#orcamento a[data-cta="orcamento"]').isVisible(), false);
    assert.equal(await page.locator('.how').isVisible(), false);
    assert.equal(await page.locator('form').count(), 0, 'sem <form>');
    assert.match(await page.locator('.wiz-progress').textContent(), /Passo 1 de 3/);
    const events = await page.evaluate(() =>
      window.dataLayer.filter((item) => item.event === 'wizard_step'),
    );
    assert.deepEqual(
      events.map((item) => [item.step, item.exp_quote_wizard]),
      [[1, 'B']],
    );
    await context.close();
  });

  test('valida cada passo no lugar, marca o campo com problema e leva o foco até ele', async () => {
    const { page, context } = await open(B);
    await page.waitForSelector('.wizard');
    await page.locator('.wizard').getByRole('button', { name: 'Próximo' }).click();
    assert.match(await page.locator('.wiz-error').textContent(), /Escolha um produto/);
    await page.locator('.wizard').getByText('Corte e vinco', { exact: true }).click();
    assert.equal(await page.locator('.wiz-error').textContent(), '', 'o erro some ao escolher');
    await page.locator('.wizard').getByRole('button', { name: 'Próximo' }).click();
    await page.locator('.wizard').getByRole('button', { name: 'Próximo' }).click();
    assert.match(await page.locator('.wiz-error').textContent(), /comprimento, largura e altura/);
    assert.equal(
      await page.evaluate(() => document.activeElement.getAttribute('aria-invalid')),
      'true',
      'o foco vai para o primeiro campo com problema',
    );
    await page.getByLabel('Comprimento (cm)').fill('999');
    await page.locator('.wizard').getByRole('button', { name: 'Próximo' }).click();
    assert.match(await page.locator('.wiz-error').textContent(), /de 1 a 300/);
    await context.close();
  });

  test('monta a mensagem do WhatsApp com o código de origem e a envia pelo botão', async () => {
    const { page, context } = await open(B);
    await page.waitForSelector('.wizard');
    await fill(page);
    const link = page.locator('.wizard a[data-cta="orcamento-assistente"]');
    const url = new URL(await link.getAttribute('href'));
    assert.match(url.pathname, /^\/55\d{10,11}$/, 'o número é o do .env');
    assert.equal(
      url.searchParams.get('text'),
      'Olá! Quero um orçamento. Produto: Corte e vinco · Medida (C x L x A): ' +
        '30 x 20 x 15 cm · Quantidade: 500 · Impressão: Com a minha marca, uma cor ' +
        '[site-orcamento-assistente]',
    );
    await link.click();
    const click = await page.evaluate(() =>
      window.dataLayer.find((item) => item.event === 'whatsapp_click'),
    );
    assert.deepEqual([click.cta, click.exp_quote_wizard], ['orcamento-assistente', 'B']);
    await context.close();
  });

  test('"Ainda não sei as medidas" dispensa as medidas e voltar mantém as respostas', async () => {
    const { page, context } = await open(B);
    await page.waitForSelector('.wizard');
    await fill(page, { medida: false });
    const text = new URL(
      await page.locator('.wizard a[data-cta]').getAttribute('href'),
    ).searchParams.get('text');
    assert.ok(text.includes('Medida (C x L x A): preciso de ajuda para medir'), text);
    await page.getByRole('button', { name: 'Voltar' }).click();
    assert.equal(
      await page
        .locator('.wizard label', { hasText: 'Com a minha marca, uma cor' })
        .locator('input')
        .isChecked(),
      true,
    );
    await page.getByRole('button', { name: 'Voltar' }).click();
    assert.equal(await page.getByLabel('Quantidade', { exact: true }).inputValue(), '500');
    assert.equal(await page.getByLabel('Ainda não sei as medidas').isChecked(), true);
    await context.close();
  });

  test('cada controle tem rótulo, o foco vai para o passo ao avançar e o contraste é de 7:1', async () => {
    const { page, context } = await open(B);
    await page.waitForSelector('.wizard');
    await page.locator('.wizard').getByText('Corte e vinco', { exact: true }).click();
    await page.locator('.wizard').getByRole('button', { name: 'Próximo' }).click();
    assert.equal(await page.evaluate(() => document.activeElement.className), 'wiz-step');
    const info = await page.evaluate(() => {
      const luminance = ([r, g, b]) => {
        const [R, G, B] = [r, g, b].map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
      };
      const rgb = (css) =>
        css
          .match(/\d+(\.\d+)?/g)
          .slice(0, 3)
          .map(Number);
      const ratio = (selector, backgroundOf) => {
        const fg = luminance(rgb(getComputedStyle(document.querySelector(selector)).color));
        const bg = luminance(
          rgb(getComputedStyle(document.querySelector(backgroundOf)).backgroundColor),
        );
        const [hi, lo] = [fg, bg].sort((a, b) => b - a);
        return (hi + 0.05) / (lo + 0.05);
      };
      return {
        unlabeled: [...document.querySelectorAll('.wizard input')].filter(
          (i) => i.labels.length === 0,
        ).length,
        legend: ratio('.wizard legend', '#orcamento'),
        option: ratio('.wiz-opt span', '.wiz-opt'),
        input: ratio('.wiz-field input', '.wiz-field input'),
        next: ratio('.wiz-nav .btn-light', '.wiz-nav .btn-light'),
        back: ratio('.wiz-nav .btn-soft', '.wiz-nav .btn-soft'),
        heights: [...document.querySelectorAll('.wizard button, .wiz-field input, .wiz-opt')].map(
          (el) => el.getBoundingClientRect().height,
        ),
      };
    });
    assert.equal(info.unlabeled, 0, 'todo campo tem rótulo');
    for (const key of ['legend', 'option', 'input', 'next', 'back']) {
      assert.ok(info[key] >= 7, `${key}: ${info[key].toFixed(2)}:1`);
    }
    for (const height of info.heights) assert.ok(height >= 44 - 0.5, `alvo com ${height}px`);
    await context.close();
  });

  test('no celular: sem rolagem horizontal e o assistente cabe na tela', async () => {
    const { page, context } = await open(B, {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    });
    await page.waitForSelector('.wizard');
    await fill(page);
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      wizard: document.querySelector('.wizard').getBoundingClientRect().right - innerWidth,
    }));
    assert.ok(result.overflow <= 0 && result.wizard <= 0, JSON.stringify(result));
    await context.close();
  });
});
