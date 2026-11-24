// A política de privacidade em content/privacidade.md. Um Markdown mínimo, de propósito (nenhuma
// dependência): só o que a política usa.
//
//   # Título                  o título da página (h1); o 1º parágrafo depois dele é o resumo (lead)
//   ## Subtítulo              um título de seção (h2)
//   texto, linhas seguidas    um parágrafo (uma linha em branco separa os parágrafos)
//   [texto](https://...)      link; também [texto](tel:{{telefone}}) e [texto](wa:privacidade), que
//                             abre o WhatsApp com a mensagem whatsapp.mensagens.privacidade
//   {{variavel}}, {{#se variavel}}...{{/se}}   os mesmos dos outros textos (build/texto.js); o
//                             {{#se}} pode abranger parágrafos e títulos inteiros
//
// O texto passa primeiro pela linguagem dos textos (variáveis e {{#se}} resolvidos, tudo escapado) e só
// depois vira HTML. HTML escrito à mão, títulos ### e outros tipos de link são erro de build.
import { RICH_VARS } from '../site.config.js';
import { renderText } from './texto.js';

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const TARGET = /^(https:\/\/\S+|tel:\{\{telefone\}\}|wa:[a-z]+)$/;

/** Os problemas do texto da política (links, HTML, níveis de título), sem resolver as variáveis. */
export function policyProblems(markdown) {
  const problems = [];
  const lines = markdown.split('\n');
  for (const [i, line] of lines.entries()) {
    const at = `linha ${i + 1}`;
    if (/[<>]/.test(line)) {
      problems.push(
        `${at}: HTML não é aceito; use só texto, "#" e "##" para títulos e [texto](link)`,
      );
    }
    if (/^#{3,}\s/.test(line)) problems.push(`${at}: só há títulos # e ##`);
    for (const [, , target] of line.matchAll(LINK)) {
      if (!TARGET.test(target)) {
        problems.push(
          `${at}: o link (${target}) não é aceito; use https://..., tel:{{telefone}} ou wa:privacidade`,
        );
      }
    }
  }
  if (!/^# \S/m.test(markdown)) problems.push('falta o título "# ..." da página');
  return problems;
}

/**
 * A política pronta para o HTML.
 * @param {string} markdown o conteúdo de privacidade.md
 * @param {{ vars: Record<string, string>, content: { whatsapp: { mensagens: Record<string, string> } } }} site
 */
export function renderPolicy(markdown, site) {
  const where = 'content/privacidade.md';
  const text = renderText(markdown, site.vars, { rich: RICH_VARS, spans: true, where });
  const inline = (block) =>
    block.replace(LINK, (_, label, target) => {
      if (target.startsWith('wa:')) {
        const cta = target.slice(3);
        const message = site.content.whatsapp.mensagens[cta];
        if (!message)
          throw new Error(`${where}: não há whatsapp.mensagens.${cta} para o link wa:${cta}`);
        const rendered = renderText(message, site.vars, {
          rich: RICH_VARS,
          where: `whatsapp.mensagens.${cta}`,
        });
        return `<a data-cta="${cta}" data-wa="${rendered}">${label}</a>`;
      }
      return `<a href="${target}">${label}</a>`;
    });
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean);
  let afterTitle = false;
  return blocks
    .map((block) => {
      if (block.startsWith('## ')) return `<h2>${inline(block.slice(3))}</h2>`;
      if (block.startsWith('# ')) {
        afterTitle = true;
        return `<h1>${inline(block.slice(2))}</h1>`;
      }
      const lead = afterTitle;
      afterTitle = false;
      return `<p${lead ? ' class="lead"' : ''}>${inline(block)}</p>`;
    })
    .join('\n');
}
