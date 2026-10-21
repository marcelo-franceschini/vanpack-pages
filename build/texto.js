// A linguagem dos textos de content/: texto comum com dois recursos, os mesmos nos arquivos .yaml e no
// privacidade.md.
//
//   {{variavel}}                 o dado da empresa (cidade, telefone...); o build lista os nomes
//                                válidos se você errar um
//   {{#se variavel}}...{{/se}}   o trecho só aparece se a variável tiver valor ({{#se rua cidade}}: só
//                                se todas as listadas tiverem valor)
//   {{#senao variavel}}...{{/senao}}   o contrário: só aparece se ela estiver vazia (ou, com várias,
//                                se alguma estiver vazia)
//
// Tudo é escapado para HTML (aspas, &, <, >), exceto as variáveis "ricas" (`anos`, `ano`), que o próprio
// build monta como HTML (o número que o navegador recalcula). Sem dependências: roda só no build.

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const TAG =
  /\{\{\s*(?:(#senao|#se|\/senao|\/se)(?!\w)\s*)?([A-Za-z_]\w*(?:\s+[A-Za-z_]\w*)*)?\s*\}\}/g;

/**
 * Lê o texto em partes: texto puro, variáveis e trechos condicionais. Lança um erro em português se a
 * sintaxe estiver errada (chave sem fechar, {{#se}} sem {{/se}}, {{#se}} dentro de {{#se}}).
 * @returns {{ parts: object[], names: Set<string> }}
 */
function parse(text, where) {
  const parts = [];
  const names = new Set();
  /** @type {{ when: boolean, name: string, parts: object[] } | null} */
  let open = null; // trecho condicional aberto
  let last = 0;
  const push = (part) => (open ? open.parts : parts).push(part);
  /**
   * @param {string} problem
   * @returns {never}
   */
  function fail(problem) {
    throw new Error(`${where}: ${problem}`);
  }
  for (const match of text.matchAll(TAG)) {
    const [raw, command, listed] = match;
    const name = listed?.trim().replace(/\s+/g, ' ');
    if (match.index > last) push({ text: text.slice(last, match.index) });
    last = match.index + raw.length;
    if (!command) {
      if (!name) fail(`chaves vazias ({{}}) em "${text}"`);
      if (name.includes(' '))
        fail(`{{${name}}}: só uma variável por vez fora de {{#se}}, em "${text}"`);
      names.add(name);
      push({ variable: name });
    } else if (command.startsWith('#')) {
      if (!name) fail(`falta o nome depois de {{${command}}} em "${text}"`);
      if (open) fail(`{{#se}} dentro de {{#se}} não é aceito, em "${text}"`);
      for (const each of name.split(' ')) names.add(each);
      open = { when: command === '#se', name, parts: [] };
    } else {
      const wanted = command === '/se';
      if (!open || open.when !== wanted) {
        fail(`{{${command}}} sem o {{#${command.slice(1)} ...}} correspondente, em "${text}"`);
      }
      if (name && name !== open.name) {
        fail(
          `{{${command} ${name}}} não fecha {{#${command.slice(1)} ${open.name}}}, em "${text}"`,
        );
      }
      parts.push({ conditional: open });
      open = null;
    }
  }
  if (open) fail(`{{#${open.when ? 'se' : 'senao'} ${open.name}}} sem fechamento, em "${text}"`);
  if (last < text.length) parts.push({ text: text.slice(last) });
  const rest = parts.filter((part) => part.text).map((part) => part.text);
  for (const piece of rest) {
    if (/\{\{|\}\}/.test(piece)) fail(`chaves {{ }} mal formadas em "${text}"`);
  }
  return { parts, names };
}

/** Os nomes de variável que o texto usa (para o build conferir se existem). */
export function textVariables(text, where = 'texto') {
  return parse(String(text), where).names;
}

/** O problema de sintaxe do texto, ou '' se estiver certo. */
export function textProblem(text) {
  try {
    parse(String(text), 'texto');
    return '';
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).replace(/^texto: /, '');
  }
}

/**
 * O texto pronto para o HTML.
 * @param {string} text
 * @param {Record<string, string>} vars valor de cada variável ('' = sem dado)
 * @param {object} [options]
 * @param {Set<string>} [options.rich] variáveis cujo valor já é HTML (entram sem escapar)
 * @param {string} [options.where] de onde vem o texto, para as mensagens de erro
 */
export function renderText(text, vars, { rich = new Set(), where = 'texto' } = {}) {
  const { parts } = parse(String(text), where);
  const value = (name) => {
    if (!(name in vars)) {
      throw new Error(
        `${where}: a variável {{${name}}} não existe. Use: ${Object.keys(vars).sort().join(', ')}.`,
      );
    }
    return vars[name];
  };
  const out = (list) =>
    list
      .map((part) => {
        if (part.text !== undefined) return escapeHtml(part.text);
        if (part.variable !== undefined) {
          const v = value(part.variable);
          if (!v) {
            throw new Error(
              `${where}: {{${part.variable}}} está vazia; proteja o trecho com {{#se ${part.variable}}}...{{/se}}.`,
            );
          }
          return rich.has(part.variable) ? v : escapeHtml(v);
        }
        const { when, name, parts: inner } = part.conditional;
        const all = name.split(' ').every((each) => Boolean(value(each)));
        return all === when ? out(inner) : '';
      })
      .join('');
  return out(parts);
}
